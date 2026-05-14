import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Team = 'team1' | 'team2' | 'team1f' | 'team2f';
type DayType = 'normal' | 'arrival' | 'departure';

interface LeaderRow { id: string; name: string; age: number | null; }
interface LeaderTeamRow { leader_id: string; team: Team; }
interface ShiftType { id: string; slug: string; day_type: DayType; sort_order: number; }

interface AssignmentInsert {
  schedule_id: string;
  day_index: number;
  day_type: DayType;
  shift_type_id: string;
  assignment_type: 'team' | 'leader';
  team_name: string | null;
  leader_id: string | null;
  role: string;
  note: string | null;
}

interface SpecialDutyInsert {
  schedule_id: string;
  day_index: number;
  duty_type: 'morgenvakt' | 'bingsvakt' | 'nattevakt' | 'frokostvakt' | 'kjokkenvakt';
  leader_id: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function next<T>(rotation: T[], cursor: { i: number }): T {
  const item = rotation[cursor.i % rotation.length];
  cursor.i += 1;
  return item;
}

function nextPair<T>(rotation: T[][], cursor: { i: number }): T[] {
  if (rotation.length === 0) return [];
  const item = rotation[cursor.i % rotation.length];
  cursor.i += 1;
  return item;
}

function pairsWithin<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return shuffle(pairs);
}

function pairsAcross<T extends { id: string }>(a: T[], b: T[]): T[][] {
  const pairs: T[][] = [];
  for (const x of a) {
    for (const y of b) {
      pairs.push([x, y]);
    }
  }
  return shuffle(pairs);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Auth check — must be admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
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
    const year = Number(body.year ?? 2026);
    const period_length = Number(body.period_length ?? 7);

    if (!period_number || period_number < 1 || period_number > 20) {
      return new Response(JSON.stringify({ error: 'period_number must be 1-20' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (![7, 8].includes(period_length)) {
      return new Response(JSON.stringify({ error: 'period_length must be 7 or 8' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client for writes
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch leaders + their team for this period
    const { data: teamRows, error: teamErr } = await admin
      .from('leader_teams')
      .select('leader_id, team')
      .eq('period_number', period_number)
      .eq('year', year);
    if (teamErr) throw teamErr;
    if (!teamRows || teamRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No team setup for this period' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leaderIds = teamRows.map((r) => r.leader_id);
    const { data: leadersData, error: leadersErr } = await admin
      .from('leaders')
      .select('id, name, age')
      .in('id', leaderIds)
      .eq('is_active', true);
    if (leadersErr) throw leadersErr;

    const leaderMap = new Map<string, LeaderRow>(
      (leadersData || []).map((l) => [l.id, l as LeaderRow]),
    );
    const teamFor = new Map<string, Team>(teamRows.map((r) => [r.leader_id, r.team as Team]));

    const groupedAll: Record<Team, LeaderRow[]> = { team1: [], team2: [], team1f: [], team2f: [] };
    for (const r of teamRows) {
      const ldr = leaderMap.get(r.leader_id);
      if (ldr) groupedAll[r.team as Team].push(ldr);
    }

    const validation: { passed: boolean; warnings: string[]; errors: string[] } = {
      passed: true, warnings: [], errors: [],
    };
    const minPer: Record<Team, number> = { team1: 4, team2: 4, team1f: 2, team2f: 2 };
    (Object.keys(minPer) as Team[]).forEach((t) => {
      if (groupedAll[t].length < minPer[t]) {
        validation.warnings.push(`${t}: kun ${groupedAll[t].length} ledere (anbefalt ${minPer[t]})`);
      }
    });

    // Fetch shift_types
    const { data: shiftTypesData, error: stErr } = await admin
      .from('shift_types')
      .select('id, slug, day_type, sort_order');
    if (stErr) throw stErr;
    const stMap = new Map<string, ShiftType>();
    for (const st of (shiftTypesData || []) as ShiftType[]) {
      stMap.set(`${st.day_type}:${st.slug}`, st);
    }
    const stId = (day_type: DayType, slug: string) => {
      const st = stMap.get(`${day_type}:${slug}`);
      if (!st) throw new Error(`Missing shift_type ${day_type}:${slug}`);
      return st.id;
    };

    // Upsert (or replace) the schedule
    const { data: existing } = await admin
      .from('shift_schedules')
      .select('id, status')
      .eq('period_number', period_number)
      .eq('year', year)
      .maybeSingle();
    if (existing && existing.status === 'published') {
      return new Response(JSON.stringify({ error: 'Period is published — archive first to regenerate' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let scheduleId: string;
    if (existing) {
      // Wipe assignments + duties, keep schedule row
      await admin.from('shift_assignments').delete().eq('schedule_id', existing.id);
      await admin.from('special_duties').delete().eq('schedule_id', existing.id);
      await admin.from('shift_schedules').update({
        period_length, status: 'draft', generated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      scheduleId = existing.id;
    } else {
      const { data: ins, error: insErr } = await admin
        .from('shift_schedules')
        .insert({ period_number, year, period_length, status: 'draft' })
        .select('id').single();
      if (insErr) throw insErr;
      scheduleId = ins.id;
    }

    const assignments: AssignmentInsert[] = [];
    const duties: SpecialDutyInsert[] = [];

    // Rotation cursors
    const morgenRot: Record<'team1f' | 'team2f', LeaderRow[]> = {
      team1f: shuffle(groupedAll.team1f),
      team2f: shuffle(groupedAll.team2f),
    };
    const morgenCur = { team1f: { i: 0 }, team2f: { i: 0 } };
    const bingsRot = { team1f: pairsWithin(groupedAll.team1f), team2f: pairsWithin(groupedAll.team2f) };
    const bingsCur = { team1f: { i: 0 }, team2f: { i: 0 } };
    const kjokkenRot = shuffle([...groupedAll.team1f, ...groupedAll.team2f]);
    const kjokkenCur = { i: 0 };
    const nattRot = pairsAcross(groupedAll.team1, groupedAll.team2);
    const nattCur = { i: 0 };
    const frokostRot = { team1: pairsWithin(groupedAll.team1), team2: pairsWithin(groupedAll.team2) };
    const frokostCur = { team1: { i: 0 }, team2: { i: 0 } };

    const teamsAll: Team[] = ['team1', 'team2', 'team1f', 'team2f'];

    for (let dayIndex = 0; dayIndex < period_length; dayIndex++) {
      if (dayIndex === 0) {
        // ARRIVAL
        const dt: DayType = 'arrival';
        const arrivalSlugs = [
          'forberedelser', 'lunsj_mote', 'ankomst', 'middag_ankomst',
          'informasjon', 'intro_moter',
        ];
        for (const slug of arrivalSlugs) {
          for (const t of teamsAll) {
            assignments.push({ schedule_id: scheduleId, day_index: dayIndex, day_type: dt,
              shift_type_id: stId(dt, slug), assignment_type: 'team', team_name: t,
              leader_id: null, role: 'standard', note: null });
          }
        }
        // 18+ shifts
        for (const slug of ['kiosk', 'legging_ankomst', 'nattevakt_ankomst']) {
          for (const t of ['team1', 'team2'] as Team[]) {
            assignments.push({ schedule_id: scheduleId, day_index: dayIndex, day_type: dt,
              shift_type_id: stId(dt, slug), assignment_type: 'team', team_name: t,
              leader_id: null, role: 'standard', note: null });
          }
        }
      } else if (dayIndex === period_length - 1) {
        // DEPARTURE
        const dt: DayType = 'departure';
        const slugs = ['vekking_avreise', 'rydding', 'frokost_avreise', 'utdeling_pass',
          'avreise', 'lunsj_mote_avreise', 'opprydning1', 'opprydning2'];
        for (const slug of slugs) {
          for (const t of teamsAll) {
            assignments.push({ schedule_id: scheduleId, day_index: dayIndex, day_type: dt,
              shift_type_id: stId(dt, slug), assignment_type: 'team', team_name: t,
              leader_id: null, role: 'standard', note: null });
          }
        }
      } else {
        // NORMAL day with A/B rotation
        const dt: DayType = 'normal';
        const isTypeA = dayIndex % 2 === 1;
        const dagteam: Team = isTypeA ? 'team1' : 'team2';
        const kveldsteam: Team = isTypeA ? 'team2' : 'team1';
        const under18a: 'team1f' | 'team2f' = isTypeA ? 'team1f' : 'team2f';
        const under18b: 'team1f' | 'team2f' = isTypeA ? 'team2f' : 'team1f';

        // Special duty rotation
        const morgenLeader = morgenRot[under18a].length
          ? next(morgenRot[under18a], morgenCur[under18a]) : null;
        const bingsPair = bingsRot[under18b].length
          ? nextPair(bingsRot[under18b], bingsCur[under18b]) : [];
        const kjokkenLeader = kjokkenRot.length ? next(kjokkenRot, kjokkenCur) : null;
        const nattPair = nattRot.length ? nextPair(nattRot, nattCur) : [];
        const frokostPair = frokostRot[dagteam].length
          ? nextPair(frokostRot[dagteam], frokostCur[dagteam]) : [];

        if (morgenLeader) duties.push({ schedule_id: scheduleId, day_index: dayIndex, duty_type: 'morgenvakt', leader_id: morgenLeader.id });
        for (const l of bingsPair) duties.push({ schedule_id: scheduleId, day_index: dayIndex, duty_type: 'bingsvakt', leader_id: l.id });
        if (kjokkenLeader) duties.push({ schedule_id: scheduleId, day_index: dayIndex, duty_type: 'kjokkenvakt', leader_id: kjokkenLeader.id });
        for (const l of nattPair) duties.push({ schedule_id: scheduleId, day_index: dayIndex, duty_type: 'nattevakt', leader_id: l.id });
        for (const l of frokostPair) duties.push({ schedule_id: scheduleId, day_index: dayIndex, duty_type: 'frokostvakt', leader_id: l.id });

        const push = (slug: string, team: Team | 'all', note: string | null = null) => {
          assignments.push({
            schedule_id: scheduleId, day_index: dayIndex, day_type: dt,
            shift_type_id: stId(dt, slug), assignment_type: 'team',
            team_name: team, leader_id: null, role: 'standard', note,
          });
        };
        const pushLeader = (slug: string, leader: LeaderRow, role = 'standard') => {
          assignments.push({
            schedule_id: scheduleId, day_index: dayIndex, day_type: dt,
            shift_type_id: stId(dt, slug), assignment_type: 'leader',
            team_name: null, leader_id: leader.id, role, note: null,
          });
        };

        // Build day
        if (morgenLeader) pushLeader('morgenvakt', morgenLeader, 'morgenvakt');
        push('vekking', under18a);
        for (const l of frokostPair) pushLeader('frokost', l, 'frokostvakt');
        push('frokost', under18a);
        for (const l of bingsPair) pushLeader('bings_morgen', l, 'bingsvakt');
        push('personalmoete', dagteam);
        push('personalmoete', under18a);
        push('personalmoete', under18b);
        push('okt1', dagteam);
        push('okt1', under18a);
        push('okt1', under18b, '**');
        push('middag', dagteam, '*');
        push('middag', under18b);
        for (const l of bingsPair) pushLeader('bings_ettermiddag', l, 'bingsvakt');
        push('personalmoete2', 'all');
        push('okt2', dagteam);
        push('okt2', under18a, '***');
        push('okt2', under18b);
        push('kveldsmat', under18a, '***');
        push('kveldsmat', kveldsteam);
        for (const l of bingsPair) pushLeader('bings_kveld', l, 'bingsvakt');
        push('okt3', kveldsteam);
        push('legging', kveldsteam, '****');
        push('legging', dagteam, '*****');
        for (const l of nattPair) pushLeader('nattevakt', l, 'nattevakt');
        if (kjokkenLeader) pushLeader('kjokkenvakt', kjokkenLeader, 'kjokkenvakt');
      }
    }

    // Bulk insert
    if (assignments.length) {
      const { error: aErr } = await admin.from('shift_assignments').insert(assignments);
      if (aErr) throw aErr;
    }
    if (duties.length) {
      const { error: dErr } = await admin.from('special_duties').insert(duties);
      if (dErr) throw dErr;
    }

    return new Response(JSON.stringify({
      schedule_id: scheduleId,
      status: 'draft',
      days: period_length,
      assignments_count: assignments.length,
      duties_count: duties.length,
      validation,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('generate-shift-schedule error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});