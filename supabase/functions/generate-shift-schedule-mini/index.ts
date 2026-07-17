import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DayType = 'normal' | 'arrival' | 'departure';
interface LeaderRow { id: string; name: string; team: string | null; }
interface ShiftType {
  id: string; slug: string; day_type: DayType; sort_order: number;
  start_time: string; end_time: string; duration_hours: number; min_leaders: number;
}
interface Warning {
  leader_id: string | null;
  leader_name: string | null;
  day_index: number;
  rule: 'understaffed' | '8h_max' | 'f_team_after_21' | '11h_rest';
  detail: string;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function shiftInterval(st: ShiftType, day: number) {
  const base = day * 24 * 60;
  const s = toMin(st.start_time);
  let e = toMin(st.end_time);
  if (e <= s) e += 24 * 60;
  return { startAbs: base + s, endAbs: base + e };
}
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdminData } = await userClient.rpc('is_admin');
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const period_number = Number(body.period_number);
    const year = Number(body.year ?? new Date().getFullYear());
    const period_length = Math.max(1, Math.min(14, Number(body.period_length ?? 7)));
    const leader_ids: string[] = Array.isArray(body.leader_ids) ? body.leader_ids : [];
    const include_arrival = body.include_arrival !== false;
    const include_departure = body.include_departure !== false;
    const force_regenerate = Boolean(body.force_regenerate);

    if (!period_number || period_number < 1 || period_number > 20) {
      return new Response(JSON.stringify({ error: 'period_number må være 1-20' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (leader_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Velg minst én leder' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load selected leaders
    const { data: ldrData, error: ldrErr } = await admin
      .from('leaders').select('id, name, team').in('id', leader_ids);
    if (ldrErr) throw ldrErr;
    const leaders: LeaderRow[] = (ldrData || []) as LeaderRow[];
    if (leaders.length === 0) {
      return new Response(JSON.stringify({ error: 'Fant ingen av de valgte lederne' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load shift types
    const { data: stData, error: stErr } = await admin
      .from('shift_types').select('id, slug, day_type, sort_order, start_time, end_time, duration_hours, min_leaders');
    if (stErr) throw stErr;
    const shiftTypes = ((stData || []) as ShiftType[])
      .filter((st) => st.min_leaders > 0)
      .sort((a, b) => a.sort_order - b.sort_order);

    // Upsert / reset schedule row
    const { data: existing } = await admin.from('shift_schedules')
      .select('id, status').eq('period_number', period_number).eq('year', year).maybeSingle();
    if (existing && existing.status === 'published' && !force_regenerate) {
      return new Response(JSON.stringify({ error: 'Perioden er publisert — arkiver først eller bruk force_regenerate' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let scheduleId: string;
    if (existing) {
      if (existing.status === 'published' && force_regenerate) {
        await admin.from('shift_schedules').update({ status: 'archived' }).eq('id', existing.id);
      }
      await admin.from('shift_assignments').delete().eq('schedule_id', existing.id);
      await admin.from('special_duties').delete().eq('schedule_id', existing.id);
      await admin.from('shift_schedules').update({
        period_length, status: 'draft', generated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      scheduleId = existing.id;
    } else {
      const { data: ins, error: insErr } = await admin.from('shift_schedules')
        .insert({ period_number, year, period_length, status: 'draft' })
        .select('id').single();
      if (insErr) throw insErr;
      scheduleId = ins.id;
    }

    // Work-tracking + fairness state
    const work = new Map<string, { startAbs: number; endAbs: number; day: number; st: ShiftType }[]>();
    const totalCount = new Map<string, number>();
    const inc = (id: string) => totalCount.set(id, (totalCount.get(id) || 0) + 1);
    const cnt = (id: string) => totalCount.get(id) || 0;
    const record = (leaderId: string, day: number, st: ShiftType) => {
      const iv = shiftInterval(st, day);
      const arr = work.get(leaderId) || [];
      arr.push({ ...iv, day, st });
      work.set(leaderId, arr);
    };

    const HARD_CAP = 8;
    const HARD_CAP_NIGHT = 8.6; // matches revalidate-shift-schedule

    // Union of intervals so overlapping shifts don't double-count.
    const dayHoursIfAdded = (leaderId: string, day: number, extra: ShiftType | null) => {
      const ivs: [number, number][] = [];
      for (const iv of work.get(leaderId) || []) {
        if (iv.day !== day) continue;
        const s = toMin(iv.st.start_time);
        let e = toMin(iv.st.end_time);
        if (e <= s) e += 24 * 60;
        ivs.push([s, e]);
      }
      if (extra) {
        const s = toMin(extra.start_time);
        let e = toMin(extra.end_time);
        if (e <= s) e += 24 * 60;
        ivs.push([s, e]);
      }
      if (ivs.length === 0) return 0;
      ivs.sort((a, b) => a[0] - b[0]);
      let total = 0;
      let [cs, ce] = ivs[0];
      for (let i = 1; i < ivs.length; i++) {
        const [s, e] = ivs[i];
        if (s <= ce) ce = Math.max(ce, e);
        else { total += ce - cs; [cs, ce] = [s, e]; }
      }
      total += ce - cs;
      return total / 60;
    };

    // 11h rest between days
    const violates11hRest = (leaderId: string, day: number, st: ShiftType) => {
      const iv = shiftInterval(st, day);
      const arr = work.get(leaderId) || [];
      for (const prev of arr) {
        if (prev.day === day - 1) {
          if (iv.startAbs - prev.endAbs > 0 && iv.startAbs - prev.endAbs < 11 * 60) return true;
        }
        if (prev.day === day + 1) {
          if (prev.startAbs - iv.endAbs > 0 && prev.startAbs - iv.endAbs < 11 * 60) return true;
        }
      }
      return false;
    };

    const isFTeam = (l: LeaderRow) => {
      const t = (l.team || '').trim().toLowerCase();
      return t === '1f' || t === '2f';
    };

    // Build day plan: arrival, normal..., departure
    const dayTypes: DayType[] = [];
    for (let d = 0; d < period_length; d++) {
      if (d === 0 && include_arrival) dayTypes.push('arrival');
      else if (d === period_length - 1 && include_departure) dayTypes.push('departure');
      else dayTypes.push('normal');
    }

    const assignments: any[] = [];
    const warnings: Warning[] = [];

    for (let day = 0; day < period_length; day++) {
      const dt = dayTypes[day];
      const dayShifts = shiftTypes.filter((s) => s.day_type === dt);
      const busyThisShift = new Set<string>();

      for (const st of dayShifts) {
        // Reset busy per shift slot (a leader can only have 1 shift at same slot).
        busyThisShift.clear();

        const shiftEndMin = (() => {
          const s = toMin(st.start_time);
          let e = toMin(st.end_time);
          if (e <= s) e += 24 * 60;
          return e;
        })();
        const endsAfter21 = shiftEndMin > 21 * 60;
        const isNight = st.slug === 'nattevakt' || st.slug === 'nattevakt_ankomst';

        // Eligibility filter
        const eligible = leaders.filter((l) => {
          if (busyThisShift.has(l.id)) return false;
          if (endsAfter21 && isFTeam(l)) return false;
          const cap = isNight ? HARD_CAP_NIGHT : HARD_CAP;
          if (dayHoursIfAdded(l.id, day, st) > cap) return false;
          if (violates11hRest(l.id, day, st)) return false;
          return true;
        });

        // Sort by fairness (least total assignments first), random tiebreak
        const pool = shuffle(eligible).sort((a, b) => cnt(a.id) - cnt(b.id));
        const picked = pool.slice(0, st.min_leaders);

        for (const l of picked) {
          assignments.push({
            schedule_id: scheduleId,
            day_index: day,
            day_type: dt,
            shift_type_id: st.id,
            assignment_type: 'leader',
            team_name: null,
            leader_id: l.id,
            role: 'standard',
            note: null,
            excluded_leader_ids: [],
          });
          record(l.id, day, st);
          inc(l.id);
          busyThisShift.add(l.id);
        }

        if (picked.length < st.min_leaders) {
          warnings.push({
            leader_id: null,
            leader_name: null,
            day_index: day,
            rule: 'understaffed',
            detail: `${st.slug}: ${picked.length}/${st.min_leaders} ledere (dag ${day})`,
          });
        }
      }
    }

    if (assignments.length > 0) {
      const { error: aErr } = await admin.from('shift_assignments').insert(assignments);
      if (aErr) throw aErr;
    }

    // Revalidate via existing function (returns 8h/F-team/11h warnings)
    let validationWarnings: unknown[] = [];
    try {
      const revalRes = await fetch(
        `${supabaseUrl}/functions/v1/revalidate-shift-schedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ schedule_id: scheduleId }),
        },
      );
      const rv = await revalRes.json();
      validationWarnings = rv.warnings || [];
    } catch (e) {
      console.error('revalidate failed', e);
    }

    return new Response(
      JSON.stringify({
        schedule_id: scheduleId,
        assignments_count: assignments.length,
        days: period_length,
        understaffed: warnings,
        validation: { warnings: validationWarnings },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('generate-shift-schedule-mini error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});