// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Post {
  id: string; week_id: string; date: string; name: string; post_type: string;
  start_time: string; end_time: string; crosses_midnight: boolean;
  duration_hours: number; required_leaders: number; is_main_shift: boolean; is_night: boolean;
  is_published?: boolean;
}
interface Staff { id: string; leader_id: string; max_daily_hours: number; name: string }
interface Availability {
  staff_id: string;
  date: string;
  available: boolean;
  from_time: string | null;
  to_time: string | null;
}

function postInterval(p: Post) {
  const [sh, sm] = p.start_time.split(":").map(Number);
  const [eh, em] = p.end_time.split(":").map(Number);
  return { start: sh * 60 + sm, end: p.crosses_midnight ? eh * 60 + em + 1440 : eh * 60 + em };
}
function dateAdd(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const isNight = (p: Post) => p.is_night || p.post_type === "night" || p.crosses_midnight;
const isMeal = (p: Post) => p.post_type === "meal";
/** Harde bemanningstak: maks 2 på måltider, maks 4 på Sanitas. */
const staffCap = (p: Post) =>
  isMeal(p) ? 2 : /sanitas/i.test(p.name ?? "") ? 4 : Infinity;
function isBreakfast(p: Post) {
  if (!isMeal(p)) return false;
  const [h] = p.start_time.split(":").map(Number);
  return h < 10 || /frokost/i.test(p.name);
}
function hashTie(a: string, b: string) {
  let h = 0; const s = a + b;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10000) / 10000;
}

interface State {
  totalHours: number;
  hoursByDate: Record<string, number>;
  nightShifts: number;
  mealShifts: number;
  assigned: { date: string; interval: { start: number; end: number }; night: boolean; breakfast: boolean; endAbs: number; startAbs: number }[];
}

function absMinutes(date: string, minutes: number) {
  return Date.parse(date + "T00:00:00Z") / 60000 + minutes;
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function availabilityReason(staffId: string, post: Post, availability: Map<string, Availability>) {
  const window = availability.get(`${staffId}|${post.date}`);
  if (!window) return null;
  if (!window.available) return "Utilgjengelig";

  const interval = postInterval(post);
  if (window.from_time && interval.start < clockMinutes(window.from_time)) {
    return `Tilgjengelig fra ${window.from_time.slice(0, 5)}`;
  }
  if (window.to_time) {
    let availableUntil = clockMinutes(window.to_time);
    if (window.from_time && availableUntil <= clockMinutes(window.from_time)) availableUntil += 1440;
    if (interval.end > availableUntil) return `Tilgjengelig til ${window.to_time.slice(0, 5)}`;
  }
  return null;
}

function canAssign(st: Staff, post: Post, s: State, availability: Map<string, Availability>, minRest: number) {
  const unavailableReason = availabilityReason(st.id, post, availability);
  if (unavailableReason) return { ok: false, reason: unavailableReason };
  const dailyMax = Math.min(8, Number(st.max_daily_hours ?? 8));
  const cur = s.hoursByDate[post.date] ?? 0;
  if (cur + Number(post.duration_hours) > dailyMax + 0.001)
    return { ok: false, reason: `${cur}/${dailyMax}t brukt denne dagen` };

  const pi = postInterval(post);
  const startAbs = absMinutes(post.date, pi.start);
  const endAbs = absMinutes(post.date, pi.end);

  for (const a of s.assigned) {
    if (startAbs < a.endAbs && a.startAbs < endAbs) {
      return { ok: false, reason: "Overlapper annen vakt" };
    }
    // Rest rule only applies between calendar days (daily rest), not between
    // posts on the same work day. Nattevakt (22:30-01:30) hører til samme
    // arbeidsdag som øktene tidligere samme dag, så den skal ikke blokkere dem.
    if (a.date === post.date) continue;
    const gapAfter = startAbs - a.endAbs;
    const gapBefore = a.startAbs - endAbs;
    if (gapAfter > 0 && gapAfter < minRest * 60) return { ok: false, reason: `Under ${minRest}t hvile` };
    if (gapBefore > 0 && gapBefore < minRest * 60) return { ok: false, reason: `Under ${minRest}t hvile` };
  }

  if (isBreakfast(post)) {
    const prev = dateAdd(post.date, -1);
    if (s.assigned.some(a => a.date === prev && a.night)) return { ok: false, reason: "Hadde nattevakt kvelden før" };
  }
  if (isNight(post)) {
    const next = dateAdd(post.date, 1);
    if (s.assigned.some(a => a.date === next && a.breakfast)) return { ok: false, reason: "Har frokost neste morgen" };
  }
  return { ok: true };
}

// Belønner sammenhengende vakter: en post som starter/slutter der lederen
// allerede jobber samme dag er mye bedre enn en løsrevet vakt med hull.
function adjacencyPenalty(post: Post, s: State) {
  const pi = postInterval(post);
  const startAbs = absMinutes(post.date, pi.start);
  const endAbs = absMinutes(post.date, pi.end);
  const sameDay = s.assigned.filter(a => a.date === post.date);
  if (sameDay.length === 0) return 0;
  let bestGap = Infinity;
  for (const a of sameDay) {
    const gapAfter = startAbs - a.endAbs;
    const gapBefore = a.startAbs - endAbs;
    const gap = Math.min(gapAfter >= 0 ? gapAfter : Infinity, gapBefore >= 0 ? gapBefore : Infinity);
    if (gap < bestGap) bestGap = gap;
  }
  if (!isFinite(bestGap)) return 0;
  if (bestGap === 0) return -60; // rett i forlengelse av en annen vakt
  if (bestGap <= 60) return -30; // maks 1 time hull
  if (bestGap <= 120) return -10;
  return 20 * (bestGap / 60); // straff lange hull i vakten
}

function score(st: Staff, post: Post, s: State) {
  // (se adjacencyPenalty under)
  const daily = s.hoursByDate[post.date] ?? 0;
  const target = Math.min(8, Number(st.max_daily_hours ?? 8));
  const after = daily + Number(post.duration_hours);
  return (
    100 * Math.max(0, after - target) +
    -30 * Math.max(0, target - after) +
    10 * s.totalHours +
    15 * s.nightShifts +
    8 * s.mealShifts +
    adjacencyPenalty(post, s) +
    hashTie(st.id, post.id)
  );
}

function apply(post: Post, s: State) {
  const pi = postInterval(post);
  s.totalHours += Number(post.duration_hours);
  s.hoursByDate[post.date] = (s.hoursByDate[post.date] ?? 0) + Number(post.duration_hours);
  if (isNight(post)) s.nightShifts += 1;
  if (isMeal(post)) s.mealShifts += 1;
  s.assigned.push({
    date: post.date, interval: pi, night: isNight(post), breakfast: isBreakfast(post),
    startAbs: absMinutes(post.date, pi.start), endAbs: absMinutes(post.date, pi.end),
  });
}

function sortPosts(posts: Post[], candidates: Map<string, number>) {
  const prio = (p: Post) => (isNight(p) ? 0 : isMeal(p) ? 1 : p.is_main_shift ? 2 : 3);
  return [...posts].sort((a, b) => {
    const pa = prio(a), pb = prio(b);
    if (pa !== pb) return pa - pb;
    const ca = candidates.get(a.id) ?? 0, cb = candidates.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.start_time < b.start_time ? -1 : 1;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Mangler innlogging" }, 401);
    const { data: userData, error: userErr } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ error: "Ugyldig sesjon" }, 401);

    const { data: leaderRow } = await supa.from("leaders").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!leaderRow) return json({ error: "Fant ikke lederprofil" }, 403);
    const { data: roles, error: rolesError } = await supa
      .from("user_roles")
      .select("role")
      .eq("leader_id", leaderRow.id);
    if (rolesError) return json({ error: rolesError.message }, 500);
    const roleList = (roles ?? []).map((r: any) => r.role);
    const isAdmin = roleList.some((r: any) => String(r) === "admin" || String(r) === "superadmin");
    if (!isAdmin) return json({ error: "Kun admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const week_id: string = body.week_id;
    const keepLocked: boolean = body.keep_locked !== false;
    // Begrens genereringen til utvalgte datoer (f.eks. bare én dag).
    const onlyDates: string[] | null = Array.isArray(body.only_dates) && body.only_dates.length
      ? body.only_dates.map((d: unknown) => String(d))
      : null;
    // «Alt på nytt»: ignorer dagslåsene og bygg hele uken opp igjen.
    const ignoreLocked: boolean = body.ignore_locked === true;
    if (!week_id) return json({ error: "week_id mangler" }, 400);

    const { data: week } = await supa.from("leirskole_weeks")
      .select("id, start_date, end_date, max_daily_hours, min_rest_hours").eq("id", week_id).maybeSingle();
    if (!week) return json({ error: "Fant ikke uken" }, 404);
    const minRest = Number(week.min_rest_hours ?? 11);

    // Avreisedager: admin lager egne økter der, så vi hopper over standardoppsettet.
    const { data: dayRows } = await supa.from("leirskole_week_days")
      .select("date, day_type, is_locked").eq("week_id", week_id);
    // Låste dager røres ikke: alt som står der beholdes, og generatoren
    // bemanner kun de andre dagene (timene teller likevel med).
    const lockedDates = new Set<string>(
      ignoreLocked ? [] : (dayRows ?? []).filter((d: any) => d.is_locked).map((d: any) => String(d.date)),
    );
    // Datoer utenfor utvalget behandles som låst: de røres ikke.
    if (onlyDates) {
      for (const d of dayRows ?? []) {
        const date = String((d as any).date);
        if (!onlyDates.includes(date)) lockedDates.add(date);
      }
    }
    // Ankomst- og avreisedager har bare egne økter — ingen standard maler.
    const departureDays = new Set(
      (dayRows ?? [])
        .filter((d: any) => d.day_type === "departure" || d.day_type === "arrival")
        .map((d: any) => String(d.date)),
    );

    const { data: staffRaw } = await supa.from("leirskole_staff")
      .select("id, leader_id, max_daily_hours").eq("week_id", week_id);

    // Kjøkkenvakt hele dagen: disse skal ikke fordeles på andre økter den dagen.
    const { data: kitchenRaw } = await supa.from("leirskole_kitchen_days")
      .select("staff_id, date").eq("week_id", week_id);
    const kitchenDays = new Set(
      (kitchenRaw ?? []).map((k: any) => `${k.staff_id}|${String(k.date)}`),
    );
    const leaderIds = (staffRaw ?? []).map((s: any) => s.leader_id);
    const { data: leaders } = await supa.from("leaders").select("id, name")
      .in("id", leaderIds.length ? leaderIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((leaders ?? []).map((l: any) => [l.id, l.name]));
    const staff: Staff[] = (staffRaw ?? []).map((s: any) => ({
      id: s.id, leader_id: s.leader_id,
      // Harde tak: ingen skal ha mer enn 8 timer på én dag.
      max_daily_hours: Math.min(8, Number(s.max_daily_hours ?? week.max_daily_hours ?? 8)),
      name: nameMap.get(s.leader_id) ?? "Ukjent",
    }));
    if (staff.length === 0) return json({ error: "Det er ikke nok ledere til å bemanne denne uken. Legg til flere ledere under «Tilgang»." }, 400);

    let { data: postsRaw } = await supa.from("leirskole_posts").select("*")
      .eq("week_id", week_id).order("date").order("start_time");

    // Ankomst-/avreisedager skal KUN ha admins egne økter. Rydd bort
    // standardmalene (Frokost, Økt 1-3, Middag, Kvelds, Sanitas, Nattevakt)
    // om de ble laget før dagen ble merket som ankomst/avreise.
    if (departureDays.size && (postsRaw ?? []).length) {
      const TEMPLATE_NAMES = new Set([
        "Frokost", "Økt 1", "Økt 2", "Økt 3", "Middag", "Kvelds", "Sanitas", "Nattevakt",
      ]);
      const stale = (postsRaw ?? []).filter(
        (p: any) =>
          departureDays.has(String(p.date)) &&
          TEMPLATE_NAMES.has(String(p.name)) &&
          !p.is_custom,
      );
      if (stale.length) {
        const staleIds = stale.map((p: any) => p.id);
        await supa.from("leirskole_assignments").delete().in("post_id", staleIds);
        await supa.from("leirskole_posts").delete().in("id", staleIds);
        postsRaw = (postsRaw ?? []).filter((p: any) => !staleIds.includes(p.id)) as any;
      }
    }

    if ((postsRaw ?? []).length === 0) {
      const N = staff.length;
      // Mål: hver leder skal fylle 8 timer per dag. Skaler bemanningen på
      // øktene slik at total kapasitet per dag ≈ 8 timer * antall ledere.
      // Maks 2 stk på frokost, middag og kvelds.
      const mealReq = Math.max(1, Math.min(2, Math.ceil(N / 4)));
      const frokostReq = mealReq;
      // Maks 4 stk på Sanitas.
      const sanitasReq = Math.max(1, Math.min(4, Math.ceil(N / 3)));
      const mealHours = 2 * mealReq + frokostReq; // Middag + Kvelds (1t) + Frokost (1t)
      const nightHours = 3 + sanitasReq * 0.5; // Nattevakt 3t + Sanitas 0,5t
      const shiftHoursPerLeader = 3 + 3 + 1.5; // Økt 1 + Økt 2 + Økt 3
      const needed = 8 * N - mealHours - nightHours;
      const shiftReq = Math.max(1, Math.min(N, Math.ceil(needed / shiftHoursPerLeader)));
      const days: string[] = [];
      const d0 = new Date(week.start_date + "T00:00:00Z");
      const d1 = new Date(week.end_date + "T00:00:00Z");
      for (const d = new Date(d0); d <= d1; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
      const rows: any[] = [];
      for (const date of days) {
        if (departureDays.has(date)) continue;
        rows.push(
          { week_id, date, name: "Frokost", post_type: "meal", start_time: "09:00", end_time: "10:00", required_leaders: frokostReq, is_main_shift: false, is_night: false, sort_order: 1 },
          { week_id, date, name: "Økt 1", post_type: "main_shift", start_time: "11:00", end_time: "14:00", required_leaders: shiftReq, is_main_shift: true, is_night: false, sort_order: 2 },
          { week_id, date, name: "Middag", post_type: "meal", start_time: "14:00", end_time: "15:00", required_leaders: mealReq, is_main_shift: false, is_night: false, sort_order: 3 },
          { week_id, date, name: "Økt 2", post_type: "main_shift", start_time: "16:00", end_time: "19:00", required_leaders: shiftReq, is_main_shift: true, is_night: false, sort_order: 4 },
          { week_id, date, name: "Kvelds", post_type: "meal", start_time: "19:00", end_time: "20:00", required_leaders: mealReq, is_main_shift: false, is_night: false, sort_order: 6 },
          // Siste økt står tom (upublisert) til admin fyller den ut senere på dagen.
          { week_id, date, name: "Økt 3", post_type: "main_shift", start_time: "20:00", end_time: "21:30", required_leaders: shiftReq, is_main_shift: true, is_night: false, sort_order: 5, is_published: false },
          { week_id, date, name: "Sanitas", post_type: "other", start_time: "22:30", end_time: "23:00", required_leaders: sanitasReq, is_main_shift: false, is_night: false, sort_order: 7 },
          { week_id, date, name: "Nattevakt", post_type: "night", start_time: "22:30", end_time: "01:30", required_leaders: 1, is_main_shift: false, is_night: true, sort_order: 8 },
        );
      }
      if (rows.length) {
        const { data: inserted, error: insErr } = await supa.from("leirskole_posts").insert(rows).select("*");
        if (insErr) return json({ error: `Kunne ikke opprette standardposter: ${insErr.message}` }, 500);
        postsRaw = inserted;
      }
    }

    // Sørg for at Middag (14-15) finnes, og at bemanningstakene holdes:
    // maks 2 på Frokost/Middag/Kvelds, maks 4 på Sanitas.
    {
      const rows = (postsRaw ?? []) as any[];
      const dates = [...new Set(rows.map((p) => p.date))];
      const missingMiddag = dates.filter(
        (d) => !departureDays.has(d) && !rows.some((p) => p.date === d && p.name === "Middag"),
      );
      if (missingMiddag.length) {
        const { data: ins } = await supa.from("leirskole_posts").insert(
          missingMiddag.map((date) => ({
            week_id, date, name: "Middag", post_type: "meal",
            start_time: "14:00", end_time: "15:00", required_leaders: 2,
            is_main_shift: false, is_night: false, sort_order: 3,
          })),
        ).select("*");
        rows.push(...((ins ?? []) as any[]));
      }
      for (const p of rows) {
        const cap = ["Frokost", "Middag", "Kvelds"].includes(p.name)
          ? 2
          : p.name === "Sanitas" ? 4 : null;
        if (cap !== null && Number(p.required_leaders) > cap) {
          p.required_leaders = cap;
          await supa.from("leirskole_posts").update({ required_leaders: cap }).eq("id", p.id);
        }
      }
      postsRaw = rows as any;
    }

    // ── Ukeplanleggeren styrer minimumsbemanningen på øktene ──────────────
    // Antall aktiviteter i ruta for Økt 1/2/3 = minst så mange ledere på vakt
    // (én per aktivitet). Oppfyllingsrunden legger på flere for å nå 8 timer.
    {
      const rows = (postsRaw ?? []) as any[];
      const { data: types } = await supa.from("leirskole_activity_types")
        .select("label").eq("is_active", true);
      const labels = (types ?? []).map((t: any) => String(t.label).toLowerCase());
      const { data: cells } = await supa.from("leirskole_week_plan_cells")
        .select("date, row_index, content").eq("week_id", week_id);
      // Radene i ukeplanleggeren er 1-indekserte (rad 1 = Økt 1).
      const ROW_TO_NAME: Record<number, string> = { 1: "Økt 1", 2: "Økt 2", 3: "Økt 3" };
      const countBySlot = new Map<string, number>();
      for (const c of (cells ?? []) as any[]) {
        const name = ROW_TO_NAME[Number(c.row_index)];
        if (!name) continue;
        const lines = String(c.content ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
        // «Klatring x2» = to ledere på den aktiviteten.
        const n = lines
          .filter((l) => labels.some((lb) => l.toLowerCase().includes(lb)))
          .reduce((sum, l) => {
            const m = l.match(/[x\u00d7]\s*(\d{1,2})\s*$/i);
            const k = m ? Number(m[1]) : 1;
            return sum + (Number.isFinite(k) && k > 0 ? Math.min(k, 20) : 1);
          }, 0);
        if (n > 0) countBySlot.set(`${c.date}|${name}`, n);
      }
      for (const p of rows) {
        if (!p.is_main_shift) continue;
        const wanted = countBySlot.get(`${p.date}|${p.name}`);
        if (!wanted) continue;
        const patch: Record<string, unknown> = {};
        if (Number(p.required_leaders) < wanted) {
          p.required_leaders = wanted;
          patch.required_leaders = wanted;
        }
        // Har admin lagt inn aktiviteter, er økten klar til å bemannes.
        if (p.is_published === false) {
          p.is_published = true;
          patch.is_published = true;
        }
        if (Object.keys(patch).length) {
          await supa.from("leirskole_posts").update(patch).eq("id", p.id);
        }
      }
      postsRaw = rows as any;
    }

    // Upubliserte økter er ikke satt ennå og skal ikke bemannes.
    const posts: Post[] = ((postsRaw ?? []) as any[])
      .filter((p) => p.is_published !== false)
      .filter((p) => !onlyDates || onlyDates.includes(String(p.date))) as any;
    if (posts.length === 0) return json({ error: "Ingen vaktposter for denne uken." }, 400);

    const staffIds = staff.map(s => s.id);
    const { data: avRaw, error: availabilityError } = await supa
      .from("leirskole_availability")
      .select("staff_id, date, available, from_time, to_time")
      .in("staff_id", staffIds);
    if (availabilityError) return json({ error: availabilityError.message }, 500);
    const availability = new Map<string, Availability>();
    for (const row of (avRaw ?? []) as Availability[]) {
      availability.set(`${row.staff_id}|${row.date}`, row);
    }

    const postIds = posts.map(p => p.id);
    const { data: existing } = await supa.from("leirskole_assignments").select("*").in("post_id", postIds);
    const existingArr = (existing ?? []) as any[];
    const postDateById = new Map(posts.map(p => [p.id, p.date]));
    const onKitchen = (staffId: string, date: string) => kitchenDays.has(`${staffId}|${date}`);
    // Kjøkkenledere skal ikke ha andre vakter den dagen — også låste fjernes.
    const seenKeep = new Set<string>();
    const toKeep = existingArr
      .filter(a => {
        const date = String(postDateById.get(a.post_id) ?? "");
        if (lockedDates.has(date)) return true;
        return keepLocked && a.is_locked;
      })
      .filter(a => {
        const date = String(postDateById.get(a.post_id) ?? "");
        if (lockedDates.has(date)) return true;
        return !onKitchen(a.staff_id, date);
      })
      // Dedupe: samme leder kan bare stå én gang på samme vakt.
      .filter(a => {
        const key = `${a.post_id}|${a.staff_id}`;
        if (seenKeep.has(key)) return false;
        seenKeep.add(key);
        return true;
      });
    const toDelete = existingArr.filter(a => !toKeep.includes(a));

    const stateById = new Map<string, State>();
    for (const s of staff) stateById.set(s.id, { totalHours: 0, hoursByDate: {}, nightShifts: 0, mealShifts: 0, assigned: [] });

    const postById = new Map(posts.map(p => [p.id, p]));
    const lockedByPost = new Map<string, any[]>();
    const conflicts: any[] = [];
    for (const a of toKeep) {
      const p = postById.get(a.post_id);
      const st = staff.find(x => x.id === a.staff_id);
      if (!p || !st) continue;
      const s = stateById.get(st.id)!;
      const check = canAssign(st, p, s, availability, minRest);
      if (!check.ok) conflicts.push({ post: p.name, date: p.date, leader: st.name, reason: check.reason });
      apply(p, s);
      lockedByPost.set(p.id, [...(lockedByPost.get(p.id) ?? []), a]);
    }

    const candidates = new Map<string, number>();
    for (const p of posts) {
      let n = 0;
      for (const st of staff) if (!availabilityReason(st.id, p, availability)) n++;
      candidates.set(p.id, n);
    }

    const { data: run, error: runError } = await supa.from("leirskole_generator_runs")
      .insert({ week_id, status: "running", keep_locked: keepLocked, run_by: leaderRow.id })
      .select().single();
    if (runError || !run) {
      return json({ error: runError?.message ?? "Kunne ikke starte genereringen" }, 500);
    }

    const newAssignments: any[] = [];
    const missing: any[] = [];

    for (const post of sortPosts(posts, candidates)) {
      if (lockedDates.has(post.date)) continue;
      const locked = lockedByPost.get(post.id) ?? [];
      let need = post.required_leaders - locked.length;
      need = Math.min(need, staffCap(post) - locked.length);
      if (need <= 0) continue;

      const pool = staff.filter(
        st => !locked.some(l => l.staff_id === st.id) && !onKitchen(st.id, post.date),
      );
      const evaluated = pool.map(st => {
        const s = stateById.get(st.id)!;
        const check = canAssign(st, post, s, availability, minRest);
        return { st, ok: check.ok, reason: check.reason, sc: score(st, post, s) };
      });
      const ranked = evaluated.filter(c => c.ok).sort((a, b) => a.sc - b.sc);
      const picked = ranked.slice(0, need);

      for (const c of picked) {
        apply(post, stateById.get(c.st.id)!);
        newAssignments.push({ post_id: post.id, staff_id: c.st.id, is_locked: false, assigned_manually: false, generator_run_id: run.id });
      }

      if (picked.length < need) {
        missing.push({
          post_name: post.name, date: post.date, missing: need - picked.length,
          reasons: evaluated.filter(c => !c.ok).map(c => `${c.st.name}: ${c.reason}`),
        });
      }
    }

    // ── Oppfyllingsrunde: alle ledere skal jobbe opp mot 8 timer hver dag ──
    // Legger til ekstra ledere på økter/måltider (utover minimumsbemanningen)
    // så lenge 8t-taket og 11t hvile-regelen holdes.
    const takenPairs = new Set<string>([
      ...toKeep.map((a: any) => `${a.post_id}|${a.staff_id}`),
      ...newAssignments.map((a: any) => `${a.post_id}|${a.staff_id}`),
    ]);
    // Hold styr på hvor mange som er satt opp per post, slik at måltider (2) og
    // Sanitas (4) ikke overfylles i oppfyllingsrunden.
    const countByPost = new Map<string, number>();
    for (const key of takenPairs) {
      const postId = key.split("|")[0];
      countByPost.set(postId, (countByPost.get(postId) ?? 0) + 1);
    }

    const allDates = [...new Set(posts.map(p => p.date))].sort();
    const fillPosts = (date: string) =>
      posts
        .filter(p => p.date === date && !isNight(p))
        .sort((a, b) => {
          if (a.is_main_shift !== b.is_main_shift) return a.is_main_shift ? -1 : 1;
          return Number(b.duration_hours) - Number(a.duration_hours);
        });

    for (const date of allDates) {
      if (lockedDates.has(date)) continue;
      const dayPosts = fillPosts(date);
      let progress = true;
      while (progress) {
        progress = false;
        // Ta den lederen som har minst timer denne dagen først.
        const hungry = staff
          // Kjøkkenledere jobber 8t på kjøkkenet og skal ikke fylles opp mer.
          .filter(st => !onKitchen(st.id, date))
          .map(st => ({ st, s: stateById.get(st.id)!, target: Math.min(8, Number(st.max_daily_hours ?? 8)) }))
          .filter(x => (x.s.hoursByDate[date] ?? 0) < x.target - 0.001)
          .sort((a, b) => (a.s.hoursByDate[date] ?? 0) - (b.s.hoursByDate[date] ?? 0));

        for (const { st, s } of hungry) {
          const remaining = Math.min(8, Number(st.max_daily_hours ?? 8)) - (s.hoursByDate[date] ?? 0);
          // Best-fit: velg posten som fyller opp mest av gjenstående tid uten å
          // sprenge 8t-taket, slik at ledere lander så nær 8 timer som mulig.
          const ordered = [...dayPosts].sort((a, b) => {
            const da = Number(a.duration_hours), db = Number(b.duration_hours);
            const fitA = da <= remaining + 0.001 ? 0 : 1;
            const fitB = db <= remaining + 0.001 ? 0 : 1;
            if (fitA !== fitB) return fitA - fitB;
            // Sammenhengende vakter først (økt → måltid → økt → nattevakt).
            const adjA = adjacencyPenalty(a, s), adjB = adjacencyPenalty(b, s);
            if (Math.abs(adjA - adjB) > 0.001) return adjA - adjB;
            return db - da;
          });
          for (const post of ordered) {
            if (takenPairs.has(`${post.id}|${st.id}`)) continue;
            if ((countByPost.get(post.id) ?? 0) >= staffCap(post)) continue;
            if (!canAssign(st, post, s, availability, minRest).ok) continue;
            apply(post, s);
            takenPairs.add(`${post.id}|${st.id}`);
            countByPost.set(post.id, (countByPost.get(post.id) ?? 0) + 1);
            newAssignments.push({
              post_id: post.id, staff_id: st.id, is_locked: false,
              assigned_manually: false, generator_run_id: run.id,
            });
            progress = true;
            break;
          }
        }
      }
    }

    if (toDelete.length) {
      const { error: deleteError } = await supa
        .from("leirskole_assignments")
        .delete()
        .in("id", toDelete.map((assignment) => assignment.id));
      if (deleteError) {
        await supa.from("leirskole_generator_runs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          stats: { error: deleteError.message },
        }).eq("id", run.id);
        return json({ error: deleteError.message }, 500);
      }
    }

    // Sikkerhetsnett mot duplikater (unik nøkkel post_id + staff_id).
    const seenNew = new Set<string>(toKeep.map((a: any) => `${a.post_id}|${a.staff_id}`));
    const insertRows = newAssignments.filter((a: any) => {
      const key = `${a.post_id}|${a.staff_id}`;
      if (seenNew.has(key)) return false;
      seenNew.add(key);
      return true;
    });

    if (insertRows.length) {
      const { error: insErr } = await supa.from("leirskole_assignments").insert(insertRows);
      if (insErr) {
        const { error: restoreError } = toDelete.length
          ? await supa.from("leirskole_assignments").insert(toDelete)
          : { error: null };
        await supa.from("leirskole_generator_runs").update({ status: "failed", finished_at: new Date().toISOString(), stats: { error: insErr.message } }).eq("id", run.id);
        return json({
          error: insErr.message,
          restore_error: restoreError?.message ?? null,
        }, 500);
      }
    }

    const status = missing.length === 0 && conflicts.length === 0 ? "success" : "partial";
    const warning = missing.length > 0
      ? `Det er ikke nok ledere til å fylle ${missing.reduce((sum, m) => sum + (m.missing ?? 0), 0)} vaktplass(er).`
      : conflicts.length > 0
      ? `Noen låste vakter kolliderer med nye vakter (${conflicts.length}).`
      : undefined;
    const stats = {
      assigned: insertRows.length,
      locked_kept: toKeep.length,
      missing,
      conflicts,
      leader_totals: staff.map(s => ({
        staff_id: s.id, name: s.name,
        total_hours: stateById.get(s.id)!.totalHours,
        night_shifts: stateById.get(s.id)!.nightShifts,
        meal_shifts: stateById.get(s.id)!.mealShifts,
      })).sort((a, b) => b.total_hours - a.total_hours),
    };

    await supa.from("leirskole_generator_runs").update({ status, finished_at: new Date().toISOString(), stats }).eq("id", run.id);
    return json({ status, run_id: run.id, warning, stats });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
