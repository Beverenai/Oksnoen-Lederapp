import { supabase } from '@/integrations/supabase/client';

/** Vakter som aldri fjernes automatisk – de er bemanningskritiske. */
const PROTECTED = ['nattevakt', 'middag', 'frokost', 'kvelds', 'sanitas', 'kjøkken'];

function isProtected(name: string) {
  const n = name.trim().toLowerCase();
  return PROTECTED.some((p) => n.includes(p));
}

/**
 * Sørger for at en leder ikke går over dagstaket etter en manuell tildeling.
 * Fjerner automatiske (ulåste) økter samme dag – største først – til vi er innenfor.
 * Nattevakt, måltider (middag/frokost/kvelds), Sanitas og kjøkken røres ikke.
 * Returnerer navnene på vaktene som ble fjernet.
 */
export async function trimDayHours({
  weekId,
  date,
  staffId,
  keepPostId,
  maxHours = 8,
}: {
  weekId: string;
  date: string;
  staffId: string;
  keepPostId?: string;
  maxHours?: number;
}): Promise<string[]> {
  const { data: posts } = await supabase
    .from('leirskole_posts')
    .select('id, name, duration_hours')
    .eq('week_id', weekId)
    .eq('date', date);
  const ids = (posts ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const { data: rows } = await supabase
    .from('leirskole_assignments')
    .select('id, post_id, is_locked')
    .eq('staff_id', staffId)
    .in('post_id', ids);

  const byId = new Map((posts ?? []).map((p) => [p.id, p]));
  const mine = (rows ?? []).map((r) => ({
    ...r,
    hours: Number(byId.get(r.post_id)?.duration_hours ?? 0),
    name: byId.get(r.post_id)?.name ?? 'Vakt',
  }));

  let total = mine.reduce((sum, r) => sum + r.hours, 0);
  if (total <= maxHours + 0.01) return [];

  const removable = mine
    .filter((r) => !r.is_locked && r.post_id !== keepPostId && !isProtected(r.name))
    .sort((a, b) => b.hours - a.hours);

  const removed: string[] = [];
  for (const r of removable) {
    if (total <= maxHours + 0.01) break;
    const { error } = await supabase.from('leirskole_assignments').delete().eq('id', r.id);
    if (error) continue;
    total -= r.hours;
    removed.push(r.name);
  }
  return removed;
}
