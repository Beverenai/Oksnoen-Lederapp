import { supabase } from '@/integrations/supabase/client';
import { planSlots, splitPlanLines, SESSION_ROWS } from '@/lib/leirskolePlanSlots';

interface DayContext {
  types: { key: string; label: string; emoji: string | null; is_custom?: boolean }[];
  posts: { id: string; name: string; assignments: { staff_id: string }[] }[];
  cells: { row_index: number | null; content: string | null }[];
  existing: { id: string; leader_id: string; activity: string; session: string }[];
  leaderByStaff: Map<string, { id: string; competencies: string[] }>;
}

async function loadDay(weekId: string, date: string): Promise<DayContext> {
  const [{ data: posts }, { data: cells }, { data: types }, { data: existing }, { data: staff }] =
    await Promise.all([
      supabase
        .from('leirskole_posts')
        .select('id, name, assignments:leirskole_assignments(staff_id)')
        .eq('week_id', weekId)
        .eq('date', date),
      supabase
        .from('leirskole_week_plan_cells')
        .select('row_index, content')
        .eq('week_id', weekId)
        .eq('date', date),
      supabase
        .from('leirskole_activity_types')
        .select('key, label, emoji, is_custom')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('leirskole_activity_assignments')
        .select('id, leader_id, activity, session')
        .eq('week_id', weekId)
        .eq('date', date)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      supabase.from('leirskole_staff').select('id, leader:leaders(id, leirskole_competencies)').eq('week_id', weekId),
    ]);

  const leaderByStaff = new Map(
    (staff ?? [])
      .filter((s) => s.leader)
      .map((s) => [
        s.id,
        {
          id: (s.leader as { id: string }).id,
          competencies: (((s.leader as { leirskole_competencies: string[] | null }).leirskole_competencies ??
            []) as string[]),
        },
      ]),
  );

  return {
    types: (types ?? []) as DayContext['types'],
    posts: (posts ?? []) as DayContext['posts'],
    cells: (cells ?? []) as DayContext['cells'],
    existing: (existing ?? []) as DayContext['existing'],
    leaderByStaff,
  };
}

/**
 * Fyller de tomme plassene i «Dag til dag» med ledere som står på økten.
 * Finner aldri opp aktiviteter som ikke står i ruten, og gir aldri samme
 * aktivitet flere ledere enn antallet i ruten (f.eks. «Klatring x2»).
 * Returnerer antall tildelinger som ble laget.
 */
export async function assignMissingActivities({
  weekId,
  date,
}: {
  weekId: string;
  date: string;
}): Promise<number> {
  const ctx = await loadDay(weekId, date);
  let created = 0;

  for (const row of SESSION_ROWS) {
    const post = ctx.posts.find((p) => (p.name ?? '').trim().toLowerCase() === row.label.toLowerCase());
    if (!post) continue;
    const onDuty = (post.assignments ?? [])
      .map((a) => ctx.leaderByStaff.get(a.staff_id))
      .filter((l): l is { id: string; competencies: string[] } => !!l);
    if (!onDuty.length) continue;

    const lines = splitPlanLines(ctx.cells.find((c) => c.row_index === row.row)?.content);
    const sessionActs = ctx.existing.filter((a) => a.session === row.session);
    const { slots } = planSlots(lines, ctx.types, sessionActs);

    const held = new Set(slots.filter((s) => s.leaderId).map((s) => s.leaderId as string));
    const openSlots = slots.filter((s) => !s.leaderId);
    if (!openSlots.length) continue;

    for (const leader of onDuty) {
      if (held.has(leader.id)) continue;
      if (!openSlots.length) break;
      // Egendefinerte aktiviteter kan alle ta — ellers styrer kompetansen.
      const openTypes = new Map(ctx.types.map((t) => [t.key, t]));
      const i = openSlots.findIndex(
        (s) =>
          openTypes.get(s.key)?.is_custom ||
          leader.competencies.length === 0 ||
          leader.competencies.includes(s.key),
      );
      const slot = openSlots.splice(i >= 0 ? i : 0, 1)[0];
      // Lederen kan ha en gammel aktivitet utenfor planen — den erstattes.
      await supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', weekId)
        .eq('date', date)
        .eq('session', row.session)
        .eq('leader_id', leader.id);
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: weekId,
        date,
        session: row.session,
        leader_id: leader.id,
        activity: slot.key,
        auto_generated: true,
      });
      if (error) continue;
      held.add(leader.id);
      created += 1;
    }
  }

  return created;
}

/**
 * Rydder én dag: sletter aktivitetstildelinger som ikke finnes i «Dag til dag»
 * (eller som er utover antallet i ruten), og fyller deretter tomme plasser.
 */
export async function resolveDayActivities({
  weekId,
  date,
}: {
  weekId: string;
  date: string;
}): Promise<{ removed: number; created: number }> {
  const ctx = await loadDay(weekId, date);
  const staleIds: string[] = [];

  for (const row of SESSION_ROWS) {
    const lines = splitPlanLines(ctx.cells.find((c) => c.row_index === row.row)?.content);
    const sessionActs = ctx.existing.filter((a) => a.session === row.session);
    if (!sessionActs.length) continue;
    const { staleLeaderIds } = planSlots(lines, ctx.types, sessionActs);
    staleLeaderIds.forEach((leaderId) => {
      sessionActs
        .filter((a) => a.leader_id === leaderId)
        .forEach((a) => staleIds.push(a.id));
    });
  }

  if (staleIds.length) {
    await supabase.from('leirskole_activity_assignments').delete().in('id', staleIds);
  }

  const created = await assignMissingActivities({ weekId, date });
  return { removed: staleIds.length, created };
}

/** Rydder flere dager (hopper over låste dager). */
export async function resolveLeirskoleConflicts({
  weekId,
  dates,
  maxHours = 8,
}: {
  weekId: string;
  dates: string[];
  /** Timegrense per leder per dag — brukes når nye ledere settes på vakter. */
  maxHours?: number;
}): Promise<{ removed: number; created: number }> {
  let removed = 0;
  let created = 0;
  for (const date of dates) {
    const r = await resolveDayActivities({ weekId, date });
    removed += r.removed;
    created += r.created;
    // Er det fortsatt tomme plasser? Sett flere ledere på vakten og fyll dem.
    const staffed = await staffOpenSlots({ weekId, date, maxHours });
    created += staffed;
  }
  return { removed, created };
}

const toMin = (t: string) => {
  const [h, m] = (t ?? '00:00').slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/**
 * Setter ledige ledere på vakter der «Dag til dag» har plasser uten leder,
 * og gir dem plassen. Respekterer timegrensen per dag, kjøkkenvakt og at
 * lederen ikke kan stå på to økter samtidig.
 */
export async function staffOpenSlots({
  weekId,
  date,
  maxHours,
}: {
  weekId: string;
  date: string;
  maxHours: number;
}): Promise<number> {
  const ctx = await loadDay(weekId, date);
  const [{ data: dayPosts }, { data: kitchen }] = await Promise.all([
    supabase
      .from('leirskole_posts')
      .select('id, name, start_time, end_time, duration_hours, assignments:leirskole_assignments(staff_id)')
      .eq('week_id', weekId)
      .eq('date', date),
    supabase.from('leirskole_kitchen_days').select('staff_id').eq('week_id', weekId).eq('date', date),
  ]);

  const kitchenIds = new Set((kitchen ?? []).map((k) => k.staff_id));
  const postList = (dayPosts ?? []) as {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    duration_hours: number | null;
    assignments: { staff_id: string }[];
  }[];

  /** Timer og opptatte tidsrom per leder denne dagen. */
  const hours = new Map<string, number>();
  const busy = new Map<string, { s: number; e: number }[]>();
  postList.forEach((p) => {
    const s = toMin(p.start_time);
    let e = toMin(p.end_time);
    if (e <= s) e += 1440;
    p.assignments.forEach((a) => {
      hours.set(a.staff_id, (hours.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0));
      busy.set(a.staff_id, [...(busy.get(a.staff_id) ?? []), { s, e }]);
    });
  });

  const typeByKey = new Map(ctx.types.map((t) => [t.key, t]));
  let created = 0;

  for (const row of SESSION_ROWS) {
    const post = postList.find((p) => (p.name ?? '').trim().toLowerCase() === row.label.toLowerCase());
    if (!post) continue;
    const lines = splitPlanLines(ctx.cells.find((c) => c.row_index === row.row)?.content);
    const sessionActs = ctx.existing.filter((a) => a.session === row.session);
    const { slots } = planSlots(lines, ctx.types, sessionActs);
    const open = slots.filter((s) => !s.leaderId);
    if (!open.length) continue;

    const s = toMin(post.start_time);
    let e = toMin(post.end_time);
    if (e <= s) e += 1440;
    const duration = Number(post.duration_hours ?? 0);
    const onPost = new Set(post.assignments.map((a) => a.staff_id));
    const held = new Set(slots.filter((x) => x.leaderId).map((x) => x.leaderId as string));

    for (const slot of open) {
      // Kandidater: ikke kjøkken, ikke på økten, innenfor timegrensen, ingen overlapp.
      const candidates = Array.from(ctx.leaderByStaff.entries())
        .filter(([staffId, leader]) => {
          if (kitchenIds.has(staffId) || onPost.has(staffId) || held.has(leader.id)) return false;
          if ((hours.get(staffId) ?? 0) + duration > maxHours + 0.01) return false;
          return !(busy.get(staffId) ?? []).some((b) => b.s < e && s < b.e);
        })
        .sort((a, b) => (hours.get(a[0]) ?? 0) - (hours.get(b[0]) ?? 0));

      const pick =
        candidates.find(
          ([, l]) =>
            typeByKey.get(slot.key)?.is_custom || l.competencies.length === 0 || l.competencies.includes(slot.key),
        ) ?? candidates[0];
      if (!pick) break;
      const [staffId, leader] = pick;

      const { error: assignError } = await supabase
        .from('leirskole_assignments')
        .insert({ post_id: post.id, staff_id: staffId, assigned_manually: false });
      if (assignError) continue;
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: weekId,
        date,
        session: row.session,
        leader_id: leader.id,
        activity: slot.key,
        auto_generated: true,
      });
      if (error) continue;
      onPost.add(staffId);
      held.add(leader.id);
      hours.set(staffId, (hours.get(staffId) ?? 0) + duration);
      busy.set(staffId, [...(busy.get(staffId) ?? []), { s, e }]);
      created += 1;
    }
  }

  return created;
}
