/**
 * Sikkerhetsnett rundt «Generer uken»: ta et bilde av uken før vi skriver,
 * så admin kan angre hele genereringen med én knapp.
 */
import { supabase } from '@/integrations/supabase/client';

export interface LeirskoleSnapshot {
  weekId: string;
  takenAt: string;
  cells: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  activityAssignments: Record<string, unknown>[];
}

export async function takeLeirskoleSnapshot(weekId: string): Promise<LeirskoleSnapshot> {
  const [{ data: cells }, { data: posts }, { data: acts }] = await Promise.all([
    supabase.from('leirskole_week_plan_cells').select('*').eq('week_id', weekId),
    supabase.from('leirskole_posts').select('*').eq('week_id', weekId),
    supabase.from('leirskole_activity_assignments').select('*').eq('week_id', weekId),
  ]);
  const postIds = (posts ?? []).map((p) => p.id as string);
  const { data: assignments } = postIds.length
    ? await supabase.from('leirskole_assignments').select('*').in('post_id', postIds)
    : { data: [] as Record<string, unknown>[] };

  return {
    weekId,
    takenAt: new Date().toISOString(),
    cells: (cells ?? []) as Record<string, unknown>[],
    posts: (posts ?? []) as Record<string, unknown>[],
    assignments: (assignments ?? []) as Record<string, unknown>[],
    activityAssignments: (acts ?? []) as Record<string, unknown>[],
  };
}

/** Rull uken tilbake til snapshotet. Alt som ble laget etterpå fjernes. */
export async function restoreLeirskoleSnapshot(snap: LeirskoleSnapshot) {
  const { weekId } = snap;

  await supabase.from('leirskole_activity_assignments').delete().eq('week_id', weekId);
  await supabase.from('leirskole_week_plan_cells').delete().eq('week_id', weekId);
  // Vaktene slettes via kaskade når postene slettes.
  await supabase.from('leirskole_posts').delete().eq('week_id', weekId);

  if (snap.posts.length) {
    const { error } = await supabase.from('leirskole_posts').insert(snap.posts as never);
    if (error) throw error;
  }
  if (snap.assignments.length) {
    const { error } = await supabase.from('leirskole_assignments').insert(snap.assignments as never);
    if (error) throw error;
  }
  if (snap.cells.length) {
    const { error } = await supabase.from('leirskole_week_plan_cells').insert(snap.cells as never);
    if (error) throw error;
  }
  if (snap.activityAssignments.length) {
    const { error } = await supabase.from('leirskole_activity_assignments').insert(snap.activityAssignments as never);
    if (error) throw error;
  }
}
