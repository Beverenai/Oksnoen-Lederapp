import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Warning {
  leader_id: string;
  leader_name: string;
  day_index: number | null;
  rule: '8h_max' | 'f_team_after_21' | '11h_rest';
  detail: string;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function shiftInterval(start_time: string, end_time: string, dayIndex: number) {
  const dayBase = dayIndex * 24 * 60;
  const s = toMinutes(start_time);
  let e = toMinutes(end_time);
  if (e <= s) e += 24 * 60;
  return { startAbs: dayBase + s, endAbs: dayBase + e };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { schedule_id } = await req.json();
    if (!schedule_id) {
      return new Response(JSON.stringify({ error: 'schedule_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [assRes, stRes, ldrRes] = await Promise.all([
      admin.from('shift_assignments').select('*').eq('schedule_id', schedule_id),
      admin.from('shift_types').select('*'),
      admin.from('leaders').select('id, name, team'),
    ]);
    if (assRes.error) throw assRes.error;
    if (stRes.error) throw stRes.error;
    if (ldrRes.error) throw ldrRes.error;

    const stById = new Map<string, any>((stRes.data || []).map((s: any) => [s.id, s]));
    const ldrById = new Map<string, any>((ldrRes.data || []).map((l: any) => [l.id, l]));

    // Group leaders by team key so team-type assignments can be expanded to members.
    const TEAM_OF: Record<string, string> = { '1': 'team1', '2': 'team2', '1f': 'team1f', '2f': 'team2f' };
    const teamMembers: Record<string, any[]> = { team1: [], team2: [], team1f: [], team2f: [] };
    for (const l of ldrRes.data || []) {
      const k = TEAM_OF[(l.team || '').trim().toLowerCase()];
      if (k) teamMembers[k].push(l);
    }

    // Build per-leader intervals. Expand team assignments to all members of that team.
    const work = new Map<string, { startAbs: number; endAbs: number; dayIndex: number; st: any }[]>();
    const addInterval = (leaderId: string, dayIndex: number, st: any) => {
      const iv = shiftInterval(st.start_time, st.end_time, dayIndex);
      const arr = work.get(leaderId) || [];
      arr.push({ ...iv, dayIndex, st });
      work.set(leaderId, arr);
    };
    for (const a of assRes.data || []) {
      const st = stById.get(a.shift_type_id);
      if (!st) continue;
      if (a.assignment_type === 'leader' && a.leader_id) {
        addInterval(a.leader_id, a.day_index, st);
      } else if (a.assignment_type === 'team' && a.team_name && teamMembers[a.team_name]) {
        for (const m of teamMembers[a.team_name]) addInterval(m.id, a.day_index, st);
      }
    }

    const warnings: Warning[] = [];
    for (const [leaderId, intervals] of work.entries()) {
      const ldr = ldrById.get(leaderId);
      if (!ldr) continue;
      const fteam = (ldr.team || '').trim().toLowerCase();
      const isFTeam = fteam === '1f' || fteam === '2f';

      const byDay = new Map<number, typeof intervals>();
      for (const iv of intervals) {
        const arr = byDay.get(iv.dayIndex) || [];
        arr.push(iv);
        byDay.set(iv.dayIndex, arr);
      }
      for (const [day, arr] of byDay.entries()) {
        const hours = arr.reduce((s, x) => s + Number(x.st.duration_hours), 0);
        if (hours > 8.01) {
          warnings.push({
            leader_id: leaderId, leader_name: ldr.name, day_index: day,
            rule: '8h_max', detail: `${hours.toFixed(2)} timer (over 8t)`,
          });
        }
        if (isFTeam) {
          for (const iv of arr) {
            const sMin = toMinutes(iv.st.start_time);
            const eMin = toMinutes(iv.st.end_time);
            const endNorm = eMin <= sMin ? eMin + 24 * 60 : eMin;
            if (endNorm > 21 * 60) {
              warnings.push({
                leader_id: leaderId, leader_name: ldr.name, day_index: day,
                rule: 'f_team_after_21',
                detail: `${iv.st.slug} slutter ${iv.st.end_time.slice(0, 5)} — F-team kan ikke jobbe etter 21:00`,
              });
            }
          }
        }
      }

      const lastEndPerDay = new Map<number, number>();
      const firstStartPerDay = new Map<number, number>();
      for (const iv of intervals) {
        const pe = lastEndPerDay.get(iv.dayIndex);
        if (pe === undefined || iv.endAbs > pe) lastEndPerDay.set(iv.dayIndex, iv.endAbs);
        const ps = firstStartPerDay.get(iv.dayIndex);
        if (ps === undefined || iv.startAbs < ps) firstStartPerDay.set(iv.dayIndex, iv.startAbs);
      }
      const days = [...lastEndPerDay.keys()].sort((a, b) => a - b);
      for (let i = 1; i < days.length; i++) {
        const prevEnd = lastEndPerDay.get(days[i - 1])!;
        const nextStart = firstStartPerDay.get(days[i])!;
        const gap = nextStart - prevEnd;
        if (gap > 0 && gap < 11 * 60) {
          warnings.push({
            leader_id: leaderId, leader_name: ldr.name, day_index: days[i],
            rule: '11h_rest',
            detail: `Kun ${(gap / 60).toFixed(1)}t hvile mellom dag ${days[i - 1]} og dag ${days[i]} (krav 11t)`,
          });
        }
      }
    }

    return new Response(JSON.stringify({ warnings, count: warnings.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('revalidate-shift-schedule error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});