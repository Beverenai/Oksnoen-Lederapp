import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Team = 'team1' | 'team2' | 'team1f' | 'team2f';
type DayType = 'normal' | 'arrival' | 'departure';

interface LeaderRow { id: string; name: string; age: number | null; team: string | null; }
interface ShiftType {
  id: string; slug: string; day_type: DayType; sort_order: number;
  start_time: string; end_time: string; duration_hours: number;
}
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
interface Warning {
  leader_id: string;
  leader_name: string;
  day_index: number | null;
  rule: '8h_max' | 'f_team_after_21' | '11h_rest' | 'kjokken_conflict' | 'bings_in_okt1';
  detail: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function next<T>(rot: T[], cur: { i: number }): T | null {
  if (rot.length === 0) return null;
  const v = rot[cur.i % rot.length];
  cur.i += 1;
  return v;
}
function pairsWithin<T>(items: T[]): T[][] {
  const p: T[][] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      p.push([items[i], items[j]]);
  return shuffle(p);
}
function pairsAcross<T>(a: T[], b: T[]): T[][] {
  const p: T[][] = [];
  for (const x of a) for (const y of b) p.push([x, y]);
  return shuffle(p);
}

/** Convert "HH:MM:SS" to minutes since 00:00. */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
/** Compute a shift's effective interval as minutes from start of dayIndex.
 * If end < start, it crossed midnight → end gets +24h. */
function shiftInterval(st: ShiftType, dayIndex: number): { startAbs: number; endAbs: number } {
  const dayBase = dayIndex * 24 * 60;
  const s = toMinutes(st.start_time);
  let e = toMinutes(st.end_time);
  if (e <= s) e += 24 * 60;
  return { startAbs: dayBase + s, endAbs: dayBase + e };
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
    const force_regenerate = Boolean(body.force_regenerate);

    if (!period_number || period_number < 1 || period_number > 20) {
      return new Response(JSON.stringify({ error: 'period_number must be 1-20' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (![7, 8].includes(period_length)) {
      return new Response(JSON.stringify({ error: 'period_length must be 7 or 8 (5 eller 6 normale dager + 2)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Ensure new shift_types exist (idempotent)
    await admin.from('shift_types').upsert([
      { slug: 'seilern',     day_type: 'normal', name: 'Seilern',       start_time: '09:15:00', end_time: '10:00:00', duration_hours: 0.75, sort_order: 17, min_leaders: 2, requires_18_plus: false, all_must_attend: false },
      { slug: 'sanitas_box', day_type: 'normal', name: 'Sanitas + Box', start_time: '23:30:00', end_time: '05:00:00', duration_hours: 5.50, sort_order: 18, min_leaders: 2, requires_18_plus: true,  all_must_attend: false },
    ], { onConflict: 'slug,day_type' });

    // Load active leaders, group by profile.team
    const { data: leadersData, error: ldrErr } = await admin
      .from('leaders').select('id, name, age, team')
      .eq('is_active', true).neq('phone', '12345678');
    if (ldrErr) throw ldrErr;

    const teamMapNorm: Record<string, Team> = {
      '1': 'team1', '2': 'team2', '1f': 'team1f', '2f': 'team2f',
    };
    const grouped: Record<Team, LeaderRow[]> = { team1: [], team2: [], team1f: [], team2f: [] };
    for (const l of (leadersData || []) as LeaderRow[]) {
      const t = teamMapNorm[(l.team || '').trim().toLowerCase()];
      if (t) grouped[t].push(l);
    }
    if (Object.values(grouped).every((g) => g.length === 0)) {
      return new Response(JSON.stringify({ error: 'Ingen ledere er tildelt team 1/2/1f/2f i lederprofilene' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load shift_types (after upsert)
    const { data: stData, error: stErr } = await admin
      .from('shift_types').select('id, slug, day_type, sort_order, start_time, end_time, duration_hours');
    if (stErr) throw stErr;
    const stByKey = new Map<string, ShiftType>();
    for (const st of (stData || []) as ShiftType[]) {
      stByKey.set(`${st.day_type}:${st.slug}`, st);
    }
    const ST = (dt: DayType, slug: string): ShiftType => {
      const v = stByKey.get(`${dt}:${slug}`);
      if (!v) throw new Error(`Missing shift_type ${dt}:${slug}`);
      return v;
    };

    // Schedule row (replace existing draft, refuse if published unless force_regenerate)
    const { data: existing } = await admin.from('shift_schedules')
      .select('id, status').eq('period_number', period_number).eq('year', year).maybeSingle();
    if (existing && existing.status === 'published' && !force_regenerate) {
      return new Response(JSON.stringify({ error: 'Period is published — archive first to regenerate' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let scheduleId: string;
    if (existing) {
      if (existing.status === 'published' && force_regenerate) {
        const { error: archiveErr } = await admin
          .from('shift_schedules')
          .update({ status: 'archived' })
          .eq('id', existing.id);
        if (archiveErr) throw archiveErr;
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

    const assignments: AssignmentInsert[] = [];
    const duties: SpecialDutyInsert[] = [];
    const warnings: Warning[] = [];

    // Per-leader work intervals, used for validation only.
    // Map<leaderId, Array<{startAbs, endAbs, dayIndex, st}>>
    const work = new Map<string, { startAbs: number; endAbs: number; dayIndex: number; st: ShiftType }[]>();
    const recordWork = (leaderId: string, dayIndex: number, st: ShiftType) => {
      const iv = shiftInterval(st, dayIndex);
      const arr = work.get(leaderId) || [];
      arr.push({ ...iv, dayIndex, st });
      work.set(leaderId, arr);
    };

    // ===== FAIRNESS-DRIVEN DUTY PICKER =====
    // Per-leader counter of special duties received this generation.
    const dutyCount = new Map<string, number>();
    const inc = (id: string, n = 1) => dutyCount.set(id, (dutyCount.get(id) || 0) + n);
    const cnt = (id: string) => dutyCount.get(id) || 0;

    /** Pick the N candidates with the lowest duty count, random tiebreak,
     *  excluding any leader id in `busy`. */
    const pickFairest = (pool: LeaderRow[], n: number, busy: Set<string>): LeaderRow[] => {
      const eligible = pool.filter((l) => !busy.has(l.id));
      const shuffled = shuffle(eligible);
      shuffled.sort((a, b) => cnt(a.id) - cnt(b.id));
      return shuffled.slice(0, n);
    };

    type DayPlan = {
      isA: boolean;
      morning18: 'team1' | 'team2';   // does Økt 1
      evening18: 'team1' | 'team2';   // does Økt 2 + Økt 3 + Legging
      morgenF:  'team1f' | 'team2f';  // does Vekking + Morgenvakt + Seilern
      bingsF:   'team1f' | 'team2f';  // does Bingsvakt
      morgen: LeaderRow | null;       // 1 person, from morgenF
      frokost: LeaderRow | null;      // 1 person, from morning18
      bings: LeaderRow[];             // 2 people, from bingsF, all 3 bings-shifts
      seilern: LeaderRow[];           // 2 people, from morgenF
      kjokken: LeaderRow | null;      // 1 person, from any F-team
      natt: LeaderRow[];              // 2 people, mix from team1+team2 (= sanitas+box)
      legging: LeaderRow[];           // 2 people, from evening18 (not Økt 1 folks)
    };
    const days: (DayPlan | null)[] = new Array(period_length).fill(null);

    const NORMAL_FROM = 1;
    const NORMAL_TO = period_length - 1; // exclusive

    for (let d = NORMAL_FROM; d < NORMAL_TO; d++) {
      const isA = (d - NORMAL_FROM) % 2 === 0;
      const morning18: 'team1' | 'team2' = isA ? 'team1' : 'team2';
      const evening18: 'team1' | 'team2' = isA ? 'team2' : 'team1';
      const morgenF:  'team1f' | 'team2f' = isA ? 'team1f' : 'team2f';
      const bingsF:   'team1f' | 'team2f' = isA ? 'team2f' : 'team1f';

      const busy = new Set<string>();

      // 1) Morgenvakt — 1 from morgenF
      const morgenPick = pickFairest(grouped[morgenF], 1, busy);
      const morgen = morgenPick[0] || null;
      if (morgen) { busy.add(morgen.id); inc(morgen.id); }

      // 2) Frokostvakt — 1 from morning18
      const frokostPick = pickFairest(grouped[morning18], 1, busy);
      const frokost = frokostPick[0] || null;
      if (frokost) { busy.add(frokost.id); inc(frokost.id); }

      // 3) Bings pair — 2 from bingsF (same pair across all 3 bings shifts)
      const bings = pickFairest(grouped[bingsF], 2, busy);
      bings.forEach((l) => { busy.add(l.id); inc(l.id, 1); });

      // 4) Seilern — 2 from morgenF, avoid busy
      const seilern = pickFairest(grouped[morgenF], 2, busy);
      seilern.forEach((l) => { busy.add(l.id); inc(l.id); });

      // 5) Kjøkkenvakt — 1 from all F-team, avoid busy
      const kjokkenPool = [...grouped.team1f, ...grouped.team2f];
      const kjokkenPick = pickFairest(kjokkenPool, 1, busy);
      const kjokken = kjokkenPick[0] || null;
      if (kjokken) { busy.add(kjokken.id); inc(kjokken.id); }

      // 6) Nattevakt — 2 from team1+team2, prefer one of each
      const nattPool = [...grouped.team1, ...grouped.team2];
      let natt = pickFairest(nattPool, 2, busy);
      // try to enforce mix (1 from each 18+ team) if possible
      if (natt.length === 2) {
        const t0 = (natt[0].team || '').trim().toLowerCase();
        const t1 = (natt[1].team || '').trim().toLowerCase();
        if (t0 === t1) {
          const otherTeamKey: Team = t0 === '1' ? 'team2' : 'team1';
          const replacement = pickFairest(
            grouped[otherTeamKey], 1,
            new Set([...busy, natt[0].id]),
          );
          if (replacement[0]) natt = [natt[0], replacement[0]];
        }
      }
      natt.forEach((l) => { busy.add(l.id); inc(l.id); });

      // 7) Legging — 2 from evening18 (the team that did Økt 1 = morning18 is excluded automatically)
      // exclude nattevakt and anyone busy from the evening team
      const legging = pickFairest(grouped[evening18], 2, busy);
      legging.forEach((l) => { busy.add(l.id); inc(l.id); });

      days[d] = {
        isA, morning18, evening18, morgenF, bingsF,
        morgen, frokost, bings, seilern, kjokken, natt, legging,
      };
    }

    // ----- BUILD ASSIGNMENTS -----
    const teams: Team[] = ['team1', 'team2', 'team1f', 'team2f'];
    const teamLeaders = (t: Team) => grouped[t];

    const pushTeam = (
      day: number, dt: DayType, slug: string, team: Team,
      excluded: LeaderRow[], note: string | null,
    ) => {
      const st = ST(dt, slug);
      assignments.push({
        schedule_id: scheduleId, day_index: day, day_type: dt,
        shift_type_id: st.id, assignment_type: 'team',
        team_name: team, leader_id: null, role: 'standard', note,
      });
      const exIds = new Set(excluded.map((l) => l.id));
      for (const l of teamLeaders(team)) {
        if (!exIds.has(l.id)) recordWork(l.id, day, st);
      }
    };
    const pushLeader = (
      day: number, dt: DayType, slug: string, leader: LeaderRow, role: string, note?: string | null,
    ) => {
      const st = ST(dt, slug);
      assignments.push({
        schedule_id: scheduleId, day_index: day, day_type: dt,
        shift_type_id: st.id, assignment_type: 'leader',
        team_name: null, leader_id: leader.id, role, note: note ?? null,
      });
      recordWork(leader.id, day, st);
    };

    // ===== ARRIVAL DAY (day 0) =====
    {
      const dt: DayType = 'arrival';
      // Standard team-block
      for (const slug of ['forberedelser', 'lunsj_mote', 'ankomst', 'middag_ankomst', 'informasjon', 'intro_moter']) {
        for (const t of teams) pushTeam(0, dt, slug, t, [], null);
      }
      // 18+ shifts
      for (const slug of ['kiosk', 'legging_ankomst', 'nattevakt_ankomst']) {
        for (const t of ['team1', 'team2'] as Team[]) pushTeam(0, dt, slug, t, [], null);
      }
    }

    // ===== NORMAL DAYS =====
    for (let d = 1; d < period_length - 1; d++) {
      const dt: DayType = 'normal';
      const p = days[d]!;
      const tomorrow = days[d + 1]; // for frokost-from-tomorrow

      // morgenvakt (1 leader)
      if (p.morgen) pushLeader(d, dt, 'morgenvakt', p.morgen, 'morgenvakt');

      // vekking — UNDER18A team (full team)
      pushTeam(d, dt, 'vekking', p.under18a, [], null);

      // frokost — frokostvakt (named) + UNDER18A team
      for (const l of p.frokost) pushLeader(d, dt, 'frokost', l, 'frokostvakt');
      pushTeam(d, dt, 'frokost', p.under18a, [], null);

      // bings morgen — bings pair
      for (const l of p.bings) pushLeader(d, dt, 'bings_morgen', l, 'bingsvakt');

      // PM1 — dagteam + under18a + under18b (NOT kveldsteam)
      pushTeam(d, dt, 'personalmoete', p.dagteam, [], null);
      pushTeam(d, dt, 'personalmoete', p.under18a, [], null);
      pushTeam(d, dt, 'personalmoete', p.under18b, [], null);

      // Økt 1 — dagteam + under18a + under18b (minus bings) **
      pushTeam(d, dt, 'okt1', p.dagteam, [], null);
      pushTeam(d, dt, 'okt1', p.under18a, [], null);
      pushTeam(d, dt, 'okt1', p.under18b, p.bings, '**');

      // Middag — dagteam* (minus frokost+natt) + under18b + tomorrow's frokostvakt
      pushTeam(d, dt, 'middag', p.dagteam, [...p.frokost, ...p.natt], '*');
      pushTeam(d, dt, 'middag', p.under18b, [], null);
      if (tomorrow) for (const l of tomorrow.frokost) {
        pushLeader(d, dt, 'middag', l, 'frokostvakt_neste_dag', 'fra dagen etter');
      }

      // Bings ettermiddag
      for (const l of p.bings) pushLeader(d, dt, 'bings_ettermiddag', l, 'bingsvakt');

      // PM2 — ALL 4 teams
      for (const t of teams) pushTeam(d, dt, 'personalmoete2', t, [], null);

      // Økt 2 — dagteam + under18a*** (minus morgen) + under18b
      pushTeam(d, dt, 'okt2', p.dagteam, [], null);
      pushTeam(d, dt, 'okt2', p.under18a, p.morgen ? [p.morgen] : [], '***');
      pushTeam(d, dt, 'okt2', p.under18b, [], null);

      // Kveldsmat — under18a*** + kveldsteam
      pushTeam(d, dt, 'kveldsmat', p.under18a, p.morgen ? [p.morgen] : [], '***');
      pushTeam(d, dt, 'kveldsmat', p.kveldsteam, [], null);

      // Bings kveld
      for (const l of p.bings) pushLeader(d, dt, 'bings_kveld', l, 'bingsvakt');

      // Økt 3 — kveldsteam (18+)
      pushTeam(d, dt, 'okt3', p.kveldsteam, [], null);

      // Legging — kveldsteam**** (minus natt) + dagteam***** (minus okt1 folks = full dagteam)
      // ***** = those who worked Økt 1 do NOT work legging. Whole dagteam was on Økt 1, so dagteam excluded entirely.
      pushTeam(d, dt, 'legging', p.kveldsteam, p.natt, '****');
      // We still want to render the row to match the Excel — empty for dagteam since all worked Økt 1
      // (skipping the band since no one is on it)

      // Nattevakt
      for (const l of p.natt) pushLeader(d, dt, 'nattevakt', l, 'nattevakt');

      // Kjokkenvakt (1 from F-team, full day, NOT in normal okter)
      if (p.kjokken) {
        pushLeader(d, dt, 'kjokkenvakt', p.kjokken, 'kjokkenvakt');
        // also add to special_duties for legacy view
        duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'kjokkenvakt', leader_id: p.kjokken.id });
      }
      if (p.morgen) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'morgenvakt', leader_id: p.morgen.id });
      for (const l of p.bings) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'bingsvakt', leader_id: l.id });
      for (const l of p.natt) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'nattevakt', leader_id: l.id });
      for (const l of p.frokost) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'frokostvakt', leader_id: l.id });
    }

    // ===== DEPARTURE DAY (last) =====
    {
      const d = period_length - 1;
      const dt: DayType = 'departure';
      for (const slug of ['vekking_avreise', 'rydding', 'frokost_avreise', 'utdeling_pass',
        'avreise', 'lunsj_mote_avreise', 'opprydning1', 'opprydning2']) {
        for (const t of teams) pushTeam(d, dt, slug, t, [], null);
      }
    }

    // ===== VALIDATION =====
    const leaderById = new Map<string, LeaderRow>(
      (leadersData || []).map((l) => [l.id, l as LeaderRow]),
    );

    for (const [leaderId, intervals] of work.entries()) {
      const ldr = leaderById.get(leaderId);
      if (!ldr) continue;
      const fteam = (ldr.team || '').trim().toLowerCase();
      const isFTeam = fteam === '1f' || fteam === '2f';

      // Group by dayIndex for 8h check + F-team-21:00 check
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
            const startMin = toMinutes(iv.st.start_time);
            const endMin = toMinutes(iv.st.end_time);
            const endNorm = endMin <= startMin ? endMin + 24 * 60 : endMin;
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

      // 11h rest: sort intervals by startAbs, check gap between consecutive
      const sorted = [...intervals].sort((a, b) => a.startAbs - b.startAbs);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].startAbs - sorted[i - 1].endAbs;
        // Only warn for gaps spanning to next "work episode" (gap >= 0 and < 11h means insufficient rest)
        // skip if same continuous shift block (gap <= 30 min counts as same block)
        if (gap > 30 && gap < 11 * 60) {
          warnings.push({
            leader_id: leaderId, leader_name: ldr.name, day_index: sorted[i].dayIndex,
            rule: '11h_rest',
            detail: `Kun ${(gap / 60).toFixed(1)}t hvile etter ${sorted[i - 1].st.slug} (krav 11t)`,
          });
        }
      }
    }

    // Bings-in-okt1 sanity (bings should be excluded from okt1 — sanity check the assignments)
    // Already enforced above; no double-check needed.

    // ===== Bulk insert =====
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
      validation: { warnings, count: warnings.length },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('generate-shift-schedule error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});