import { supabase } from '@/integrations/supabase/client';

/** Kjøkkenvakt en hel dag regnes som en full arbeidsdag. */
export const KITCHEN_DAY_HOURS = 8;

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

  const { data: kitchen } = await supabase
    .from('leirskole_kitchen_days')
    .select('id, hours')
    .eq('week_id', weekId)
    .eq('date', date)
    .eq('staff_id', staffId);
  const kitchenHours = (kitchen ?? []).reduce(
    (sum, k) => sum + Number(k.hours ?? KITCHEN_DAY_HOURS),
    0,
  );

  let total = mine.reduce((sum, r) => sum + r.hours, 0) + kitchenHours;
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

/** Hvor mange ledere det er plass til på en vakt. */
function postCapacity(name: string, requiredLeaders: number) {
  const n = name.trim().toLowerCase();
  if (/frokost|middag|kvelds|måltid/.test(n)) return Math.max(requiredLeaders, 2);
  if (n.includes('sanitas')) return Math.max(requiredLeaders, 4);
  // Nattevakt kan dobbeltbookes (to ledere på natt).
  if (n.includes('nattevakt')) return Math.max(requiredLeaders, 2);
  return Math.max(requiredLeaders, 1);
}

/**
 * Fyller opp dagen slik at ledere kommer så nær dagstaket som mulig.
 * Legger ledere med for få timer inn på vakter som har ledig plass.
 * Nattevakt røres ikke (hviletid), og de som står på kjøkken hele dagen hoppes over.
 * Returnerer antall vakter som ble lagt til.
 */
export async function fillDayHours({
  weekId,
  date,
  maxHours = 8,
}: {
  weekId: string;
  date: string;
  maxHours?: number;
}): Promise<number> {
  const [{ data: staff }, { data: posts }, { data: kitchen }] = await Promise.all([
    supabase.from('leirskole_staff').select('id, max_daily_hours').eq('week_id', weekId),
    supabase
      .from('leirskole_posts')
      .select('id, name, duration_hours, required_leaders, is_night')
      .eq('week_id', weekId)
      .eq('date', date),
    supabase.from('leirskole_kitchen_days').select('staff_id, hours').eq('week_id', weekId).eq('date', date),
  ]);

  const usable = (posts ?? []).filter((p) => !p.is_night && Number(p.duration_hours ?? 0) > 0);
  if (!staff?.length || !usable.length) return 0;

  const { data: rows } = await supabase
    .from('leirskole_assignments')
    .select('post_id, staff_id')
    .in(
      'post_id',
      (posts ?? []).map((p) => p.id),
    );

  const kitchenStaff = new Set((kitchen ?? []).map((k) => k.staff_id));
  const onPost = new Map<string, Set<string>>();
  const hours = new Map<string, number>();
  const durationById = new Map((posts ?? []).map((p) => [p.id, Number(p.duration_hours ?? 0)]));

  const kitchenHoursById = new Map((kitchen ?? []).map((k) => [k.staff_id, Number(k.hours ?? KITCHEN_DAY_HOURS)]));
  staff.forEach((s) => hours.set(s.id, kitchenHoursById.get(s.id) ?? 0));
  (rows ?? []).forEach((r) => {
    const set = onPost.get(r.post_id) ?? new Set<string>();
    set.add(r.staff_id);
    onPost.set(r.post_id, set);
    hours.set(r.staff_id, (hours.get(r.staff_id) ?? 0) + (durationById.get(r.post_id) ?? 0));
  });

  const capFor = (staffId: string) => {
    const s = staff.find((x) => x.id === staffId);
    return Math.min(Number(s?.max_daily_hours ?? maxHours), maxHours);
  };

  let added = 0;

  // 1) Fyll først vakter som mangler pålagt bemanning (Sanitas 4, måltid 2 osv.),
  //    uansett hvor nær taket lederen er — disse er bemanningskritiske.
  const understaffed = usable
    .map((p) => ({ post: p, need: postCapacity(p.name, Number(p.required_leaders ?? 1)) }))
    .filter((x) => (onPost.get(x.post.id) ?? new Set()).size < x.need)
    .sort((a, b) => Number(a.post.duration_hours ?? 0) - Number(b.post.duration_hours ?? 0));

  for (const { post, need } of understaffed) {
    while ((onPost.get(post.id) ?? new Set()).size < need) {
      const dur = Number(post.duration_hours ?? 0);
      const candidate = staff
        .filter((s) => !kitchenStaff.has(s.id))
        .filter((s) => !(onPost.get(post.id) ?? new Set()).has(s.id))
        .map((s) => ({ id: s.id, hours: hours.get(s.id) ?? 0, cap: capFor(s.id) }))
        .filter((s) => s.hours + dur <= s.cap + 0.01)
        .sort((a, b) => a.hours - b.hours)[0];
      if (!candidate) break;
      const { error } = await supabase.from('leirskole_assignments').insert({
        post_id: post.id,
        staff_id: candidate.id,
        assigned_manually: false,
      });
      if (error) break;
      const set = onPost.get(post.id) ?? new Set<string>();
      set.add(candidate.id);
      onPost.set(post.id, set);
      hours.set(candidate.id, candidate.hours + dur);
      added++;
    }
  }

  // 2) Fyll deretter opp de som ligger langt under taket.
  for (let i = 0; i < 200; i++) {
    const candidates = staff
      .filter((s) => !kitchenStaff.has(s.id))
      .map((s) => ({ id: s.id, hours: hours.get(s.id) ?? 0, cap: capFor(s.id) }))
      .filter((s) => s.hours < s.cap - 1.01)
      .sort((a, b) => a.hours - b.hours);
    if (!candidates.length) break;

    let placed = false;
    for (const c of candidates) {
      // Minste vakt som får dem nærmere taket uten å gå over.
      const options = usable
        .filter((p) => !(onPost.get(p.id) ?? new Set()).has(c.id))
        .filter((p) => (onPost.get(p.id) ?? new Set()).size < postCapacity(p.name, Number(p.required_leaders ?? 1)))
        .filter((p) => c.hours + Number(p.duration_hours ?? 0) <= c.cap + 0.01)
        .sort((a, b) => Number(b.duration_hours ?? 0) - Number(a.duration_hours ?? 0));
      const pick = options[0];
      if (!pick) continue;
      const { error } = await supabase.from('leirskole_assignments').insert({
        post_id: pick.id,
        staff_id: c.id,
        assigned_manually: false,
      });
      if (error) continue;
      const set = onPost.get(pick.id) ?? new Set<string>();
      set.add(c.id);
      onPost.set(pick.id, set);
      hours.set(c.id, c.hours + Number(pick.duration_hours ?? 0));
      added++;
      placed = true;
      break;
    }
    if (!placed) break;
  }
  return added;
}
