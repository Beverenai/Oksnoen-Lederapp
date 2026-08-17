import { supabase } from '@/integrations/supabase/client';
import { activityLine } from '@/lib/leirskoleRandomPlan';

const SESSION_ROWS: { row: number; label: string; session: string }[] = [
  { row: 1, label: 'Økt 1', session: 'formiddag' },
  { row: 2, label: 'Økt 2', session: 'ettermiddag' },
  { row: 3, label: 'Økt 3', session: 'kveld' },
];

/**
 * Sørger for at alle ledere som står på en økt har en aktivitet.
 * Bruker først aktiviteter i ukeplanen som ingen har fått, og legger ellers
 * til en ubrukt aktivitet i ruten så de ekstra lederne får noe å gjøre.
 * Returnerer antall tildelinger som ble laget.
 */
export async function assignMissingActivities({
  weekId,
  date,
}: {
  weekId: string;
  date: string;
}): Promise<number> {
  const [{ data: posts }, { data: cells }, { data: types }, { data: existing }, { data: staff }] =
    await Promise.all([
      supabase.from('leirskole_posts').select('id, name, assignments:leirskole_assignments(staff_id)').eq('week_id', weekId).eq('date', date),
      supabase.from('leirskole_week_plan_cells').select('row_index, content').eq('week_id', weekId).eq('date', date),
      supabase.from('leirskole_activity_types').select('key, label, emoji').eq('is_active', true).order('sort_order'),
      supabase.from('leirskole_activity_assignments').select('leader_id, activity, session').eq('week_id', weekId).eq('date', date),
      supabase.from('leirskole_staff').select('id, leader:leaders(id, leirskole_competencies)').eq('week_id', weekId),
    ]);

  const leaderByStaff = new Map(
    (staff ?? [])
      .filter((s) => s.leader)
      .map((s) => [
        s.id,
        {
          id: (s.leader as { id: string }).id,
          competencies: ((s.leader as { leirskole_competencies: string[] | null }).leirskole_competencies ?? []) as string[],
        },
      ]),
  );

  let created = 0;

  for (const row of SESSION_ROWS) {
    const post = (posts ?? []).find((p) => (p.name ?? '').trim().toLowerCase() === row.label.toLowerCase());
    if (!post) continue;
    const onDuty = (post.assignments ?? [])
      .map((a: { staff_id: string }) => leaderByStaff.get(a.staff_id))
      .filter((l): l is { id: string; competencies: string[] } => !!l);
    if (!onDuty.length) continue;

    const slotAssignments = (existing ?? []).filter((a) => a.session === row.session);
    const lines = ((cells ?? []).find((c) => c.row_index === row.row)?.content ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const inPlan = (types ?? []).filter((t) => lines.some((l) => l.toLowerCase().includes(t.label.toLowerCase())));
    const usedKeys = new Set(slotAssignments.map((a) => a.activity));
    const free = inPlan.filter((t) => !usedKeys.has(t.key));
    const spare = (types ?? []).filter((t) => !inPlan.some((p) => p.key === t.key));
    const nextLines = [...lines];

    for (const leader of onDuty) {
      if (slotAssignments.some((a) => a.leader_id === leader.id)) continue;
      const pick = (list: typeof free) => {
        const i = list.findIndex((t) => leader.competencies.length === 0 || leader.competencies.includes(t.key));
        return list.splice(i >= 0 ? i : 0, 1)[0];
      };
      let type = free.length ? pick(free) : undefined;
      if (!type && spare.length) {
        type = pick(spare);
        if (type) nextLines.push(activityLine(type));
      }
      if (!type) break;
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: weekId,
        date,
        session: row.session,
        leader_id: leader.id,
        activity: type.key,
        auto_generated: true,
      });
      if (error) continue;
      slotAssignments.push({ leader_id: leader.id, activity: type.key, session: row.session });
      created++;
    }

    if (nextLines.length !== lines.length) {
      await supabase.from('leirskole_week_plan_cells').upsert(
        {
          week_id: weekId,
          date,
          row_index: row.row,
          content: nextLines.join('\n'),
        },
        { onConflict: 'week_id,date,row_index' },
      );
    }
  }

  return created;
}
