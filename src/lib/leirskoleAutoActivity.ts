import { supabase } from '@/integrations/supabase/client';
import { planSlots, splitPlanLines, SESSION_ROWS } from '@/lib/leirskolePlanSlots';

interface DayContext {
  types: { key: string; label: string; emoji: string | null }[];
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
        .select('key, label, emoji')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('leirskole_activity_assignments')
        .select('id, leader_id, activity, session')
        .eq('week_id', weekId)
        .eq('date', date),
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
      const i = openSlots.findIndex(
        (s) => leader.competencies.length === 0 || leader.competencies.includes(s.key),
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
}: {
  weekId: string;
  dates: string[];
}): Promise<{ removed: number; created: number }> {
  let removed = 0;
  let created = 0;
  for (const date of dates) {
    const r = await resolveDayActivities({ weekId, date });
    removed += r.removed;
    created += r.created;
  }
  return { removed, created };
}
