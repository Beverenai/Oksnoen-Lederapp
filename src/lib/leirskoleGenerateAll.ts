/**
 * Orkestrering av «Generer hele uken» for leirskolen:
 *   1. fyll tomme ruter i ukeplanen med tilfeldige aktiviteter (rullering)
 *   2. generer vaktplanen (8t/dag, hvile, sammenhengende vakter, bemanningstak)
 *   3. fordel aktivitetene til lederne som er på vakt (kompetanse + rullering)
 *
 * Manuelle valg (låste vakter og manuelle aktiviteter) beholdes.
 */
import { supabase } from '@/integrations/supabase/client';
import { autoAssignWeek, type AutoGapRow } from '@/lib/leirskoleAutoAssign';
import { randomWeekPlan, type RandomPlanActivity } from '@/lib/leirskoleRandomPlan';

export type LeirskoleGenerateMode = 'plan' | 'schedule' | 'all';

const ROW_TO_SESSION: Record<number, string> = { 1: 'formiddag', 2: 'ettermiddag', 3: 'kveld' };
const POST_TO_SESSION: Record<string, string> = {
  'økt 1': 'formiddag',
  'økt 2': 'ettermiddag',
  'økt 3': 'kveld',
};

export interface LeirskoleGenerateSummary {
  cellsFilled: number;
  shifts: number;
  activityAssignments: number;
  gaps: AutoGapRow[];
  scheduleWarning?: string;
}

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 21) {
    out.push(d.toLocaleDateString('sv-SE'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export async function runLeirskoleGenerate({
  weekId,
  startDate,
  endDate,
  mode,
  perSession = 3,
  createdBy = null,
  overwritePlan = false,
}: {
  weekId: string;
  startDate: string;
  endDate: string;
  mode: LeirskoleGenerateMode;
  perSession?: number;
  createdBy?: string | null;
  overwritePlan?: boolean;
}): Promise<LeirskoleGenerateSummary> {
  const summary: LeirskoleGenerateSummary = {
    cellsFilled: 0,
    shifts: 0,
    activityAssignments: 0,
    gaps: [],
  };

  // ---- 1. Ukeplan ---------------------------------------------------------
  if (mode !== 'schedule') {
    const [{ data: types }, { data: days }, { data: cells }] = await Promise.all([
      supabase.from('leirskole_activity_types').select('key, label, emoji').eq('is_active', true),
      supabase.from('leirskole_week_days').select('date, day_type').eq('week_id', weekId),
      supabase.from('leirskole_week_plan_cells').select('date, row_index, content').eq('week_id', weekId),
    ]);

    const special = new Set(
      (days ?? []).filter((d) => d.day_type !== 'normal').map((d) => d.date),
    );
    const filled = new Set(
      (cells ?? [])
        .filter((c) => c.row_index != null && (c.content ?? '').trim().length > 0)
        .map((c) => `${c.date}|${c.row_index}`),
    );
    const dates = datesBetween(startDate, endDate).filter((d) => !special.has(d));

    const planned = randomWeekPlan({
      dates,
      activities: (types ?? []) as RandomPlanActivity[],
      perSession,
      filled,
      overwrite: overwritePlan,
    });

    if (planned.length) {
      const { error } = await supabase.from('leirskole_week_plan_cells').upsert(
        planned.map((p) => ({
          week_id: weekId,
          date: p.date,
          row_index: p.rowIndex,
          content: p.content,
          color: 'neutral',
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'week_id,date,row_index' },
      );
      if (error) throw error;
      summary.cellsFilled = planned.length;
    }
  }

  if (mode === 'plan') return summary;

  // ---- 2. Vaktplan -------------------------------------------------------
  const { data: genData, error: genError } = await supabase.functions.invoke(
    'generate-leirskole-schedule',
    { body: { week_id: weekId, keep_locked: true } },
  );
  if (genError) throw genError;
  const gen = genData as { error?: string; stats?: { assigned?: number } } | null;
  if (gen?.error) throw new Error(gen.error);
  summary.shifts = gen?.stats?.assigned ?? 0;

  // ---- 3. Aktiviteter til lederne ---------------------------------------
  const [{ data: types }, { data: cells }, { data: posts }, { data: weekDays }, { data: staff }, { data: existing }, { data: history }] =
    await Promise.all([
      supabase.from('leirskole_activity_types').select('key, label, emoji').eq('is_active', true),
      supabase.from('leirskole_week_plan_cells').select('date, row_index, content, post_id').eq('week_id', weekId),
      supabase
        .from('leirskole_posts')
        .select('id, date, name, is_custom, assignments:leirskole_assignments(staff_id)')
        .eq('week_id', weekId),
      supabase.from('leirskole_week_days').select('date, day_type').eq('week_id', weekId),
      supabase
        .from('leirskole_staff')
        .select('id, leader_id, leader:leaders(id, name, leirskole_competencies)')
        .eq('week_id', weekId),
      supabase
        .from('leirskole_activity_assignments')
        .select('date, session, activity, leader_id, auto_generated')
        .eq('week_id', weekId),
      supabase.from('leirskole_activity_assignments').select('leader_id, activity'),
    ]);

  const staffToLeader = new Map<string, string>();
  (staff ?? []).forEach((s) => {
    const l = s.leader as { id: string } | null;
    if (l) staffToLeader.set(s.id, l.id);
  });

  const dutyBySlot = new Map<string, string[]>();
  (posts ?? []).forEach((p) => {
    const session = POST_TO_SESSION[(p.name ?? '').trim().toLowerCase()];
    if (!session) return;
    const ids = ((p.assignments ?? []) as { staff_id: string }[])
      .map((a) => staffToLeader.get(a.staff_id))
      .filter(Boolean) as string[];
    const key = `${p.date}|${session}`;
    dutyBySlot.set(key, [...(dutyBySlot.get(key) ?? []), ...ids]);
  });

  const activeTypes = (types ?? []) as RandomPlanActivity[];
  const slots = (cells ?? [])
    .map((cell) => {
      const session = cell.row_index != null ? ROW_TO_SESSION[cell.row_index] : undefined;
      if (!session) return null;
      const lines = (cell.content ?? '')
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);
      if (!lines.length) return null;
      const activities = activeTypes
        .filter((t) => lines.some((l) => l.includes(t.label.toLowerCase())))
        .map((t) => t.key);
      if (!activities.length) return null;
      return {
        date: cell.date,
        session,
        activities,
        onDuty: dutyBySlot.get(`${cell.date}|${session}`) ?? [],
      };
    })
    .filter(Boolean) as { date: string; session: string; activities: string[]; onDuty: string[] }[];

  const manual = (existing ?? [])
    .filter((a) => !a.auto_generated)
    .map((a) => ({ date: a.date, session: a.session, activity: a.activity, leader_id: a.leader_id }));

  const result = autoAssignWeek({
    slots,
    staff: (staff ?? [])
      .map((s) => s.leader as { id: string; name: string; leirskole_competencies: string[] | null } | null)
      .filter(Boolean)
      .map((l) => ({
        leaderId: l!.id,
        name: l!.name,
        competencies: l!.leirskole_competencies ?? [],
      })),
    manual,
    history: (history ?? []).map((h) => ({ leader_id: h.leader_id, activity: h.activity })),
  });

  summary.gaps = result.gaps;

  if (result.assignments.length) {
    const dates = [...new Set(result.assignments.map((r) => r.date))];
    const { error: delError } = await supabase
      .from('leirskole_activity_assignments')
      .delete()
      .eq('week_id', weekId)
      .eq('auto_generated', true)
      .in('date', dates);
    if (delError) throw delError;

    const { error: insError } = await supabase.from('leirskole_activity_assignments').insert(
      result.assignments.map((r) => ({
        week_id: weekId,
        date: r.date,
        session: r.session,
        leader_id: r.leaderId,
        activity: r.activity,
        auto_generated: true,
        created_by: createdBy,
      })),
    );
    if (insError) throw insError;
    summary.activityAssignments = result.assignments.length;
  }

  return summary;
}
