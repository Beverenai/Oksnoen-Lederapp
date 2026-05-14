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
  excluded_leader_ids: string[];
}
interface SpecialDutyInsert {
  schedule_id: string;
  day_index: number;
  duty_type: 'morgenvakt' | 'bingsvakt' | 'nattevakt' | 'frokostvakt' | 'kjokkenvakt' | 'sanitas' | 'seilern_box' | 'neste_frokostvakt';
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

    // Ensure v5 shift_types exist (idempotent — migration also seeds these)
    await admin.from('shift_types').upsert([
      { slug: 'sanitas',     day_type: 'normal', name: 'Sanitas',       start_time: '23:30:00', end_time: '01:00:00', duration_hours: 1.50, sort_order: 17, min_leaders: 2, requires_18_plus: true,  all_must_attend: false },
      { slug: 'seilern_box', day_type: 'normal', name: 'Seilern + Box', start_time: '09:15:00', end_time: '10:00:00', duration_hours: 0.75, sort_order: 18, min_leaders: 2, requires_18_plus: false, all_must_attend: false },
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

    // ===== 8H/DAY HARD CAP =====
    // Compute total worked hours on `day` for `leaderId` if `extra` is added.
    // Uses interval UNION so overlapping shifts (e.g. kjøkkenvakt 09–17 over
    // frokost+økt1+middag) don't double-count.
    const HARD_CAP_HOURS = 8;
    const dayHoursIfAdded = (
      leaderId: string,
      day: number,
      extra: ShiftType | null,
    ): number => {
      const ivs: [number, number][] = [];
      for (const iv of work.get(leaderId) || []) {
        if (iv.dayIndex !== day) continue;
        const s = toMinutes(iv.st.start_time);
        let e = toMinutes(iv.st.end_time);
        if (e <= s) e += 24 * 60;
        ivs.push([s, e]);
      }
      if (extra) {
        const s = toMinutes(extra.start_time);
        let e = toMinutes(extra.end_time);
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
      natt: LeaderRow[];              // 2 people, from morning18 (Økt 1-team)
      nesteFrokost: LeaderRow | null; // 1 person from evening18 = next-day's frokostvakt
      sanitas: LeaderRow[];           // 2 people from morning18 (leggeteamet), NOT nattevakt
    };
    const days: (DayPlan | null)[] = new Array(period_length).fill(null);

    const NORMAL_FROM = 1;
    const NORMAL_TO = period_length - 1; // exclusive

    // Frokostvakt på dag D+1 reserveres mens dag D bygges, så samme person
    // tas med på Økt 1 på D og blir frokostvakt på D+1.
    const frokostByDay = new Map<number, LeaderRow>();

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

      // 2) Frokostvakt — reservert fra gårsdagens nesteFrokost-pick.
      //    Unntak: første normale dag har ingen forrige dag, så pickFairest.
      let frokost: LeaderRow | null = frokostByDay.get(d) || null;
      if (frokost) {
        busy.add(frokost.id); inc(frokost.id);
      } else {
        const frokostPick = pickFairest(grouped[morning18], 1, busy);
        frokost = frokostPick[0] || null;
        if (frokost) { busy.add(frokost.id); inc(frokost.id); }
      }

      // 3) Bings pair — 2 from bingsF (same pair across all 3 bings shifts)
      const bings = pickFairest(grouped[bingsF], 2, busy);
      bings.forEach((l) => { busy.add(l.id); inc(l.id, 1); });

      // 4) Seilern — 2 from morgenF, avoid busy
      const seilern = pickFairest(grouped[morgenF], 2, busy);
      seilern.forEach((l) => { busy.add(l.id); inc(l.id); });

      // 5) Kjøkkenvakt — 1 from UNDER18B (same F-team as bings), avoid busy
      const kjokkenPick = pickFairest(grouped[bingsF], 1, busy);
      const kjokken = kjokkenPick[0] || null;
      if (kjokken) { busy.add(kjokken.id); inc(kjokken.id); }

      // 6) Nattevakt — 2 from morning18 (Økt 1-team, 18+)
      const natt = pickFairest(grouped[morning18], 2, busy);
      natt.forEach((l) => { busy.add(l.id); inc(l.id); });

      // 7) Neste-dags frokostvakt — 1 from evening18 (= D+1's morning18).
      //    Deltar i PM1+Økt1+PM2+Økt2+Kveldsmat, men IKKE Økt 3 (*****).
      //    Hopp over på siste normale dag (D+1 er avreisedag).
      let nesteFrokost: LeaderRow | null = null;
      if (d + 1 < NORMAL_TO) {
        const nesteFrokostPick = pickFairest(grouped[evening18], 1, busy);
        nesteFrokost = nesteFrokostPick[0] || null;
        if (nesteFrokost) {
          busy.add(nesteFrokost.id); inc(nesteFrokost.id);
          frokostByDay.set(d + 1, nesteFrokost);
        }
      }

      // 8) Sanitas — 2 from morning18 (leggeteamet), MÅ være forskjellig fra nattevakt
      const sanitas = pickFairest(grouped[morning18], 2, busy);
      sanitas.forEach((l) => { busy.add(l.id); inc(l.id); });

      days[d] = {
        isA, morning18, evening18, morgenF, bingsF,
        morgen, frokost, bings, seilern, kjokken, natt, nesteFrokost, sanitas,
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
      // Auto-exclude any team member who would exceed the 8h/day cap by
      // joining this shift. This keeps the cap as a hard rule even on
      // long whole-team shifts (Økt 1/2/3, måltider, personalmøter).
      const exIds = new Set(excluded.map((l) => l.id));
      for (const l of teamLeaders(team)) {
        if (exIds.has(l.id)) continue;
        if (dayHoursIfAdded(l.id, day, st) > HARD_CAP_HOURS + 0.01) {
          exIds.add(l.id);
        }
      }
      assignments.push({
        schedule_id: scheduleId, day_index: day, day_type: dt,
        shift_type_id: st.id, assignment_type: 'team',
        team_name: team, leader_id: null, role: 'standard', note,
        excluded_leader_ids: [...exIds],
      });
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
        excluded_leader_ids: [],
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
    for (let d = NORMAL_FROM; d < NORMAL_TO; d++) {
      const dt: DayType = 'normal';
      const p = days[d]!;
      const tomorrow = days[d + 1]; // may be null on last normal day

      // 06:00–08:30 Morgenvakt — 1 person
      if (p.morgen) pushLeader(d, dt, 'morgenvakt', p.morgen, 'morgenvakt');

      // 08:30–09:00 Vekking — entire UNDER18A (incl. morgenvakt who is already up)
      pushTeam(d, dt, 'vekking', p.morgenF, [], null);

      // 09:00–10:00 Frokost — 1 frokostvakt (from morning18) + entire UNDER18A
      if (p.frokost) pushLeader(d, dt, 'frokost', p.frokost, 'frokostvakt');
      pushTeam(d, dt, 'frokost', p.morgenF, [], null);

      // 09:15–10:00 Seilern + Box — 2 from morgenF
      for (const l of p.seilern) pushLeader(d, dt, 'seilern_box', l, 'seilern_box');

      // 09:30–11:00 Bings morgen — bings pair
      for (const l of p.bings) pushLeader(d, dt, 'bings_morgen', l, 'bingsvakt');

      // 10:45–11:00 Personalmøte 1 — Økt 1+2-team + UNDER18A + UNDER18B + 1 fra Økt 3-team (neste frokostvakt)
      for (const t of [p.morning18, p.morgenF, p.bingsF] as Team[]) pushTeam(d, dt, 'personalmoete', t, [], null);
      if (p.nesteFrokost) pushLeader(d, dt, 'personalmoete', p.nesteFrokost, 'frokostvakt_neste_dag', 'fra dagen etter');

      // 11:00–14:00 Økt 1 — morning18 (incl. frokostvakt) + morgenF*** + bingsF** + 1 fra evening18
      pushTeam(d, dt, 'okt1', p.morning18, [], null);
      pushTeam(d, dt, 'okt1', p.morgenF, [...(p.morgen ? [p.morgen] : []), ...p.seilern], null);
      pushTeam(d, dt, 'okt1', p.bingsF, p.bings, '**');
      if (p.nesteFrokost) pushLeader(d, dt, 'okt1', p.nesteFrokost, 'frokostvakt_neste_dag', 'fra dagen etter');

      // 14:00–15:30 Middag — morning18* (minus frokost + natt) + UNDER18B (minus kjøkken)
      pushTeam(d, dt, 'middag', p.morning18, [
        ...(p.frokost ? [p.frokost] : []),
        ...p.natt,
      ], '*');
      pushTeam(d, dt, 'middag', p.bingsF, p.kjokken ? [p.kjokken] : [], null);

      // 15:30–16:00 Bings ettermiddag
      for (const l of p.bings) pushLeader(d, dt, 'bings_ettermiddag', l, 'bingsvakt');

      // 15:45–16:00 Personalmøte 2 — alle 4 team
      for (const t of teams) pushTeam(d, dt, 'personalmoete2', t, [], null);

      // 16:00–19:00 Økt 2 — Økt 2+3-team (evening18) + UNDER18A*** (minus morgen) + UNDER18B (minus kjøkken)
      // Neste-dags frokostvakt er allerede i evening18-team-pushet, ingen ekstra push.
      pushTeam(d, dt, 'okt2', p.evening18, [], null);
      pushTeam(d, dt, 'okt2', p.morgenF, p.morgen ? [p.morgen] : [], '***');
      pushTeam(d, dt, 'okt2', p.bingsF, p.kjokken ? [p.kjokken] : [], null);

      // 19:00–20:00 Kveldsmat — KUN Økt 2+3-team (evening18). INGEN F-team.
      pushTeam(d, dt, 'kveldsmat', p.evening18, [], null);

      // 20:00–20:30 Bings kveld
      for (const l of p.bings) pushLeader(d, dt, 'bings_kveld', l, 'bingsvakt');

      // 20:30–00:00 Økt 3 — evening18***** (minus de som var på Økt 1 = neste-dags frokostvakt)
      pushTeam(d, dt, 'okt3', p.evening18, p.nesteFrokost ? [p.nesteFrokost] : [], '*****');

      // 22:00–01:00 Legging — Økt 1-team**** (minus nattevakt og sanitas-paret).
      // Sanitas-paret jobber 23:30–01:00 (overlapper slutten av legging) — markeres som sanitas, ikke legging.
      pushTeam(d, dt, 'legging', p.morning18, [...p.natt, ...p.sanitas], '****');

      // 23:30–04:00 Nattevakt — 2 fra Økt 1-team
      for (const l of p.natt) pushLeader(d, dt, 'nattevakt', l, 'nattevakt');

      // 23:30–01:00 Sanitas — 2 fra Økt 1-team (leggeteamet), IKKE nattevakt
      for (const l of p.sanitas) pushLeader(d, dt, 'sanitas', l, 'sanitas');

      // Hele dagen Kjøkkenvakt — 1 from F-teams
      if (p.kjokken) pushLeader(d, dt, 'kjokkenvakt', p.kjokken, 'kjokkenvakt');

      // Special duties log
      if (p.morgen)  duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'morgenvakt',  leader_id: p.morgen.id });
      if (p.frokost) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'frokostvakt', leader_id: p.frokost.id });
      if (p.kjokken) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'kjokkenvakt', leader_id: p.kjokken.id });
      for (const l of p.bings)   duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'bingsvakt',  leader_id: l.id });
      for (const l of p.natt)    duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'nattevakt',  leader_id: l.id });
      for (const l of p.sanitas) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'sanitas',    leader_id: l.id });
      for (const l of p.seilern) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'seilern_box', leader_id: l.id });
      if (p.nesteFrokost) duties.push({ schedule_id: scheduleId, day_index: d, duty_type: 'neste_frokostvakt', leader_id: p.nesteFrokost.id });
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

      // 11h rest: only check BETWEEN workdays (last shift dayN → first shift dayN+1).
      // Within-day gaps (lunch breaks etc.) are normal and must NOT trigger this rule.
      const lastEndPerDay = new Map<number, number>();
      const firstStartPerDay = new Map<number, number>();
      for (const iv of intervals) {
        const prevEnd = lastEndPerDay.get(iv.dayIndex);
        if (prevEnd === undefined || iv.endAbs > prevEnd) lastEndPerDay.set(iv.dayIndex, iv.endAbs);
        const prevStart = firstStartPerDay.get(iv.dayIndex);
        if (prevStart === undefined || iv.startAbs < prevStart) firstStartPerDay.set(iv.dayIndex, iv.startAbs);
      }
      const workDays = [...lastEndPerDay.keys()].sort((a, b) => a - b);
      for (let i = 1; i < workDays.length; i++) {
        const prevEnd = lastEndPerDay.get(workDays[i - 1])!;
        const nextStart = firstStartPerDay.get(workDays[i])!;
        const gap = nextStart - prevEnd;
        if (gap > 0 && gap < 11 * 60) {
          warnings.push({
            leader_id: leaderId, leader_name: ldr.name, day_index: workDays[i],
            rule: '11h_rest',
            detail: `Kun ${(gap / 60).toFixed(1)}t hvile mellom dag ${workDays[i - 1]} og dag ${workDays[i]} (krav 11t)`,
          });
        }
      }
    }

    // Bings-in-okt1 sanity (bings should be excluded from okt1 — sanity check the assignments)
    // Already enforced above; no double-check needed.

    // ===== Bulk insert =====
    if (assignments.length) {
      const safeAssignments = assignments.map((a) => ({
        ...a,
        excluded_leader_ids: Array.isArray(a.excluded_leader_ids) ? a.excluded_leader_ids : [],
      }));
      const { error: aErr } = await admin.from('shift_assignments').insert(safeAssignments);
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