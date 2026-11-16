// Hub-API for lederappen: lesetilgang til leirdata for admin-dashboardet og
// for AI-assistenter (Claude, Grok) via MCP.
//
// Ett endepunkt, to måter å bruke det på:
//   1. MCP (JSON-RPC): initialize, tools/list, tools/call
//   2. Enkelt API: POST { "tool": "leir_status", "args": { ... } }
//
// Regler:
//   - Bare lesing. Ingenting kan endres herfra.
//   - Krever den hemmelige nøkkelen HUB_API_KEY i Authorization-headeren.
//   - Admin skal kunne lese alt (bestemt 16.11.2026). Verktøyene datakart og
//     rader åpner hver tabell, også sykepleier, hendelser og notater.
//   - Aldri med: PIN-koder, push-nøkler, innstillinger med hemmeligheter, og
//     det sosiale mellom lederne. Avsender på anonyme meldinger er skjult.
//   - Hvert oppslag logges i hub_api_log.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-hub-key, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Args = Record<string, unknown>;
type Db = SupabaseClient;

// ---------- Hjelpere ----------

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

function str(v: unknown, max = 80): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
}

function age(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years--;
  return years;
}

/** Henter alle rader, også når det er flere enn 1000. */
// deno-lint-ignore no-explicit-any
async function fetchAll(build: () => any, cap = 20000): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  const size = 1000;
  for (let from = 0; from < cap; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

interface Period {
  id: string;
  name: string;
  slug: string | null;
  season_year: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
}

const PERIOD_COLS = "id, name, slug, season_year, start_date, end_date, is_active";

/** Perioden det spørres om: id, slug eller navn. Uten verdi brukes aktiv periode. */
async function resolvePeriod(db: Db, wanted: unknown): Promise<Period> {
  const w = str(wanted);
  if (w) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(w);
    const q = db.from("periods").select(PERIOD_COLS);
    const { data } = isUuid ? await q.eq("id", w).limit(1) : await q.or(`slug.eq.${w.replace(/[,()]/g, "")},name.ilike.${w.replace(/[,()%]/g, "")}`).limit(1);
    if (data?.[0]) return data[0] as Period;
    throw new Error(`Fant ikke perioden «${w}». Bruk verktøyet perioder for å se hvilke som finnes.`);
  }
  const { data } = await db.from("periods").select(PERIOD_COLS).eq("is_active", true).limit(1);
  if (data?.[0]) return data[0] as Period;
  throw new Error("Det er ingen aktiv periode. Oppgi periode.");
}

const periodOut = (p: Period) => ({
  id: p.id,
  navn: p.name,
  aar: p.season_year,
  start: p.start_date,
  slutt: p.end_date,
  aktiv: !!p.is_active,
  // «Aktiv» er en bryter i appen og kan stå på etter at perioden er over.
  pagar_naa: !!p.start_date && !!p.end_date && p.start_date <= osloToday() && osloToday() <= p.end_date,
  ...(p.is_active && p.end_date && p.end_date < osloToday()
    ? { merknad: `Perioden er markert som aktiv i appen, men sluttet ${p.end_date}. Det er ikke leir nå.` }
    : {}),
});

function osloToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
}

// ---------- Verktøyene ----------

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (db: Db, args: Args) => Promise<unknown>;
  /** Argumenter helsesjekken kan bruke. null betyr at det ikke finnes data å teste med. */
  sample?: (db: Db) => Promise<Args | null>;
}

const periodeProp = {
  periode: { type: "string", description: "Periodens id, slug eller navn. Utelat for aktiv periode." },
};

const tools: Tool[] = [
  {
    name: "leir_status",
    description:
      "Status for leiren akkurat nå: aktiv periode, antall deltakere og hvor mange som har ankommet, hytter, armbånd, aktiviteter registrert i dag og totalt, og Gomla-salg.",
    inputSchema: { type: "object", properties: { ...periodeProp } },
    run: async (db, args) => {
      const p = await resolvePeriod(db, args.periode);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = async (table: string, extra?: (q: any) => any) => { // deno-lint-ignore-line no-explicit-any
        let q = db.from(table).select("id", { count: "exact", head: true }).eq("period_id", p.id);
        if (extra) q = extra(q);
        const { count: c, error } = await q;
        if (error) throw new Error(error.message);
        return c ?? 0;
      };
      const [deltakere, ankommet, band, aktiviteter, aktiviteterIDag, skanninger, cabins, ledere, salg] = await Promise.all([
        count("participants"),
        count("participants", (q) => q.eq("has_arrived", true)),
        count("wristband_assignments", (q) => q.is("released_at", null)),
        count("participant_activities"),
        count("participant_activities", (q) => q.gte("completed_at", today.toISOString())),
        count("participant_activities", (q) => q.eq("source", "qr")),
        db.from("cabins").select("id", { count: "exact", head: true }),
        db.from("leaders").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
        fetchAll(() => db.from("kiosk_sales").select("total").eq("period_id", p.id).is("voided_at", null)),
      ]);
      return {
        periode: periodOut(p),
        deltakere: { totalt: deltakere, ankommet, ikke_ankommet: deltakere - ankommet, med_armband: band },
        hytter: cabins.count ?? 0,
        aktive_ledere: ledere.count ?? 0,
        aktiviteter: { totalt: aktiviteter, i_dag: aktiviteterIDag, via_qr: skanninger },
        gomla: { antall_salg: salg.length, sum_kr: salg.reduce((s, r) => s + Number(r.total ?? 0), 0) },
        hentet: new Date().toISOString(),
      };
    },
  },
  {
    name: "perioder",
    description: "Alle perioder med år, datoer og antall deltakere. Bruk dette for å finne riktig periode til de andre verktøyene.",
    inputSchema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db.from("periods").select(PERIOD_COLS).order("start_date", { ascending: false });
      if (error) throw new Error(error.message);
      const out = [];
      for (const p of (data ?? []) as Period[]) {
        const { count } = await db.from("participants").select("id", { count: "exact", head: true }).eq("period_id", p.id);
        out.push({ ...periodOut(p), deltakere: count ?? 0 });
      }
      return out;
    },
  },
  {
    name: "deltakere",
    description:
      "Liste over deltakere i en periode: navn, alder, hytte, rom, lag, om de har ankommet, antall år på Oksnøen, armbåndnummer og antall aktiviteter. Kan filtreres på navn eller hytte.",
    inputSchema: {
      type: "object",
      properties: {
        ...periodeProp,
        sok: { type: "string", description: "Del av navnet" },
        hytte: { type: "string", description: "Navn på hytte" },
        bare_ikke_ankommet: { type: "boolean" },
        maks: { type: "number", description: "Maks antall, standard 300" },
      },
    },
    run: async (db, args) => {
      const p = await resolvePeriod(db, args.periode);
      const sok = str(args.sok).replace(/[%,()]/g, "");
      const hytte = str(args.hytte).toLowerCase();
      const maks = num(args.maks, 300, 1, 1000);
      const rows = await fetchAll(() => {
        let q = db
          .from("participants")
          .select("id, person_id, name, birth_date, room, has_arrived, times_attended, insj_points, image_thumb_url, image_url, cabins(name), participant_teams(name)")
          .eq("period_id", p.id)
          .order("name");
        if (sok) q = q.ilike("name", `%${sok}%`);
        if (args.bare_ikke_ankommet === true) q = q.or("has_arrived.is.null,has_arrived.eq.false");
        return q;
      });
      const [bands, acts] = await Promise.all([
        fetchAll(() => db.from("wristband_assignments").select("participant_id, code").eq("period_id", p.id).is("released_at", null)),
        fetchAll(() => db.from("participant_activities").select("participant_id").eq("period_id", p.id)),
      ]);
      const bandBy = new Map(bands.map((b) => [b.participant_id, b.code]));
      const actCount = new Map<string, number>();
      for (const a of acts) actCount.set(a.participant_id, (actCount.get(a.participant_id) ?? 0) + 1);
      const list = rows
        .filter((r) => !hytte || (r.cabins?.name ?? "").toLowerCase().includes(hytte))
        .map((r) => ({
          id: r.id,
          person_id: r.person_id ?? null,
          navn: r.name,
          alder: age(r.birth_date),
          hytte: r.cabins?.name ?? null,
          rom: r.room ?? null,
          lag: r.participant_teams?.name ?? null,
          ankommet: !!r.has_arrived,
          aar_paa_oksnoen: r.times_attended ?? null,
          armband: bandBy.get(r.id) ?? null,
          antall_aktiviteter: actCount.get(r.id) ?? 0,
          bilde: r.image_thumb_url ?? r.image_url ?? null,
        }));
      return { periode: periodOut(p), antall: list.length, deltakere: list.slice(0, maks) };
    },
  },
  {
    name: "deltaker",
    sample: async (db) => {
      const { data: period } = await db.from("periods").select("id").eq("is_active", true).limit(1);
      if (!period?.[0]) return null;
      const { data } = await db.from("participants").select("id").eq("period_id", period[0].id).limit(1);
      return data?.[0] ? { id: data[0].id } : null;
    },
    description: "Alt om én deltaker i en periode: hytte, rom, lag, armbånd, kommentarer fra lederne, og alle aktiviteter med tidspunkt og hvem som registrerte. Oppgi id eller navn.",
    inputSchema: {
      type: "object",
      properties: { ...periodeProp, id: { type: "string" }, navn: { type: "string" } },
    },
    run: async (db, args) => {
      const id = str(args.id);
      const navn = str(args.navn).replace(/[%,()]/g, "");
      if (!id && !navn) throw new Error("Oppgi id eller navn.");
      const cols = "id, person_id, name, birth_date, room, has_arrived, times_attended, insj_points, period_id, image_thumb_url, image_url, notes, activity_notes, cabins(name), participant_teams(name), periods(name, season_year, start_date, end_date, is_active)";
      // deno-lint-ignore no-explicit-any
      let found: any[] = [];
      if (id) {
        const { data } = await db.from("participants").select(cols).eq("id", id).limit(1);
        found = data ?? [];
      } else {
        const p = await resolvePeriod(db, args.periode);
        const { data } = await db.from("participants").select(cols).eq("period_id", p.id).ilike("name", `%${navn}%`).order("name").limit(6);
        found = data ?? [];
      }
      if (found.length === 0) throw new Error("Fant ingen deltaker.");
      if (found.length > 1) {
        return { flere_treff: found.map((r) => ({ id: r.id, navn: r.name, hytte: r.cabins?.name ?? null })) };
      }
      const r = found[0];
      const [acts, band, leaders] = await Promise.all([
        fetchAll(() => db.from("participant_activities").select("activity, completed_at, registered_by, source").eq("participant_id", r.id).order("completed_at")),
        db.from("wristband_assignments").select("code").eq("participant_id", r.id).is("released_at", null).limit(1),
        db.from("leaders").select("id, name"),
      ]);
      const leaderName = new Map((leaders.data ?? []).map((l) => [l.id, l.name]));
      // Samme barn i andre perioder og år, funnet på den faste person-ID-en.
      // deno-lint-ignore no-explicit-any
      let andre: any[] = [];
      if (r.person_id) {
        const { data } = await db
          .from("participants")
          .select("id, room, image_thumb_url, image_url, cabins(name), periods(name, season_year)")
          .eq("person_id", r.person_id)
          .neq("id", r.id);
        andre = data ?? [];
      }
      return {
        id: r.id,
        person_id: r.person_id ?? null,
        navn: r.name,
        alder: age(r.birth_date),
        hytte: r.cabins?.name ?? null,
        rom: r.room ?? null,
        lag: r.participant_teams?.name ?? null,
        ankommet: !!r.has_arrived,
        aar_paa_oksnoen: r.times_attended ?? null,
        insj_poeng: r.insj_points ?? 0,
        armband: band.data?.[0]?.code ?? null,
        bilde: r.image_thumb_url ?? r.image_url ?? null,
        periode: r.periods
          ? { id: r.period_id, navn: r.periods.name, aar: r.periods.season_year, start: r.periods.start_date, slutt: r.periods.end_date }
          : null,
        kommentarer: [
          r.notes ? { kilde: "Notat", tekst: r.notes } : null,
          r.activity_notes ? { kilde: "Aktiviteter", tekst: r.activity_notes } : null,
        ].filter(Boolean),
        andre_deltakelser: andre.map((d) => ({
          id: d.id,
          periode: d.periods?.name ?? null,
          aar: d.periods?.season_year ?? null,
          hytte: d.cabins?.name ?? null,
          rom: d.room ?? null,
          bilde: d.image_thumb_url ?? d.image_url ?? null,
        })),
        aktiviteter: acts.map((a) => ({
          aktivitet: a.activity,
          tidspunkt: a.completed_at,
          registrert_av: leaderName.get(a.registered_by) ?? null,
          via: a.source === "qr" ? "QR" : "manuelt",
        })),
      };
    },
  },
  {
    name: "person",
    sample: async (db) => {
      const { data } = await db.from("participants").select("person_id").not("person_id", "is", null).limit(1);
      return data?.[0] ? { person_id: data[0].person_id } : null;
    },
    description: "Ett barn på tvers av perioder og år, funnet på den faste person-ID-en. Søk på navn (alle perioder) eller oppgi person_id. Viser hver deltakelse for seg: periode, år, hytte, rom, bilde og antall aktiviteter. Et barn som var med i to perioder, har to deltakelser på samme ID.",
    inputSchema: {
      type: "object",
      properties: {
        person_id: { type: "string", description: "Barnets faste ID" },
        navn: { type: "string", description: "Hele eller deler av navnet. Søker i alle perioder" },
      },
    },
    run: async (db, args) => {
      const personId = str(args.person_id);
      const navn = str(args.navn).replace(/[%,()]/g, "");
      if (!personId && !navn) throw new Error("Oppgi person_id eller navn.");
      const cols = "id, person_id, name, birth_date, room, times_attended, image_thumb_url, image_url, period_id, cabins(name), periods(name, season_year, start_date)";
      const rows = await fetchAll(() => {
        let q = db.from("participants").select(cols).not("person_id", "is", null).order("name");
        q = personId ? q.eq("person_id", personId) : q.ilike("name", `%${navn}%`);
        return q;
      });
      if (rows.length === 0) throw new Error("Fant ingen person.");

      // deno-lint-ignore no-explicit-any
      const byPerson = new Map<string, any[]>();
      for (const r of rows) {
        if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, []);
        byPerson.get(r.person_id)!.push(r);
      }
      if (byPerson.size > 12) {
        throw new Error(`For mange treff (${byPerson.size}). Skriv mer av navnet.`);
      }
      // Navnesøket kan ha truffet bare én av periodene til et barn. Hent resten.
      if (!personId) {
        const ids = [...byPerson.keys()];
        const all = await fetchAll(() => db.from("participants").select(cols).in("person_id", ids));
        byPerson.clear();
        for (const r of all) {
          if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, []);
          byPerson.get(r.person_id)!.push(r);
        }
      }
      const partIds = [...byPerson.values()].flat().map((r) => r.id);
      const acts = await fetchAll(() => db.from("participant_activities").select("participant_id").in("participant_id", partIds));
      const actCount = new Map<string, number>();
      for (const a of acts) actCount.set(a.participant_id, (actCount.get(a.participant_id) ?? 0) + 1);

      const personer = [...byPerson.entries()].map(([id, list]) => {
        list.sort((a, b) => String(a.periods?.start_date ?? "").localeCompare(String(b.periods?.start_date ?? "")));
        const last = list[list.length - 1];
        return {
          person_id: id,
          navn: last.name,
          alder: age(last.birth_date),
          aar_paa_oksnoen: last.times_attended ?? null,
          antall_deltakelser: list.length,
          deltakelser: list.map((r) => ({
            deltaker_id: r.id,
            periode: r.periods?.name ?? null,
            aar: r.periods?.season_year ?? null,
            hytte: r.cabins?.name ?? null,
            rom: r.room ?? null,
            antall_aktiviteter: actCount.get(r.id) ?? 0,
            bilde: r.image_thumb_url ?? r.image_url ?? null,
          })),
        };
      });
      return personer.length === 1 ? personer[0] : { antall: personer.length, personer };
    },
  },
  {
    name: "hytter",
    description: "Alle hytter med hvem som bor der i perioden, fordelt på rom.",
    inputSchema: { type: "object", properties: { ...periodeProp } },
    run: async (db, args) => {
      const p = await resolvePeriod(db, args.periode);
      const [cabins, parts] = await Promise.all([
        db.from("cabins").select("id, name, sort_order").order("sort_order"),
        fetchAll(() => db.from("participants").select("name, room, cabin_id, has_arrived").eq("period_id", p.id).order("name")),
      ]);
      if (cabins.error) throw new Error(cabins.error.message);
      return {
        periode: periodOut(p),
        hytter: (cabins.data ?? []).map((c) => {
          const mine = parts.filter((x) => x.cabin_id === c.id);
          return {
            hytte: c.name,
            antall: mine.length,
            deltakere: mine.map((x) => ({ navn: x.name, rom: x.room ?? null, ankommet: !!x.has_arrived })),
          };
        }),
        uten_hytte: parts.filter((x) => !x.cabin_id).map((x) => x.name),
      };
    },
  },
  {
    name: "aktiviteter",
    description:
      "Uten aktivitet: hvor mange deltakere som har gjort hver aktivitet i perioden. Med aktivitet: hvem som har gjort den og hvem som mangler den.",
    inputSchema: {
      type: "object",
      properties: { ...periodeProp, aktivitet: { type: "string", description: "Navn på aktivitet, f.eks. Taubane" } },
    },
    run: async (db, args) => {
      const p = await resolvePeriod(db, args.periode);
      const wanted = str(args.aktivitet).toLowerCase();
      const [acts, parts] = await Promise.all([
        fetchAll(() => db.from("participant_activities").select("participant_id, activity").eq("period_id", p.id)),
        fetchAll(() => db.from("participants").select("id, name, cabins(name)").eq("period_id", p.id).order("name")),
      ]);
      if (!wanted) {
        const by = new Map<string, Set<string>>();
        for (const a of acts) {
          const key = String(a.activity ?? "").trim();
          if (!key) continue;
          if (!by.has(key)) by.set(key, new Set());
          by.get(key)!.add(a.participant_id);
        }
        return {
          periode: periodOut(p),
          antall_deltakere: parts.length,
          aktiviteter: [...by.entries()]
            .map(([aktivitet, set]) => ({ aktivitet, har_gjort: set.size, mangler: Math.max(0, parts.length - set.size) }))
            .sort((a, b) => b.har_gjort - a.har_gjort),
        };
      }
      const done = new Set(acts.filter((a) => String(a.activity ?? "").toLowerCase() === wanted).map((a) => a.participant_id));
      const row = (x: { name: string; cabins?: { name?: string } | null }) => ({ navn: x.name, hytte: x.cabins?.name ?? null });
      return {
        periode: periodOut(p),
        aktivitet: str(args.aktivitet),
        har_gjort: parts.filter((x) => done.has(x.id)).map(row),
        mangler: parts.filter((x) => !done.has(x.id)).map(row),
      };
    },
  },
  {
    name: "skanninger",
    description: "QR-skanninger i perioden: antall per leder og per aktivitet, og de siste skanningene. Kan begrenses til de siste timene.",
    inputSchema: {
      type: "object",
      properties: { ...periodeProp, timer: { type: "number", description: "Bare skanninger de siste N timene" } },
    },
    run: async (db, args) => {
      const p = await resolvePeriod(db, args.periode);
      const hours = args.timer === undefined ? 0 : num(args.timer, 0, 0, 24 * 60);
      const since = hours > 0 ? new Date(Date.now() - hours * 3600_000).toISOString() : null;
      const [rows, leaders, parts] = await Promise.all([
        fetchAll(() => {
          let q = db
            .from("participant_activities")
            .select("participant_id, activity, registered_by, completed_at")
            .eq("period_id", p.id)
            .eq("source", "qr")
            .order("completed_at", { ascending: false });
          if (since) q = q.gte("completed_at", since);
          return q;
        }),
        db.from("leaders").select("id, name"),
        fetchAll(() => db.from("participants").select("id, name").eq("period_id", p.id)),
      ]);
      const leaderName = new Map((leaders.data ?? []).map((l) => [l.id, l.name]));
      const partName = new Map(parts.map((x) => [x.id, x.name]));
      const tally = (key: (r: (typeof rows)[number]) => string) => {
        const m = new Map<string, number>();
        for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
        return [...m.entries()].map(([navn, antall]) => ({ navn, antall })).sort((a, b) => b.antall - a.antall);
      };
      return {
        periode: periodOut(p),
        totalt: rows.length,
        per_leder: tally((r) => leaderName.get(r.registered_by) ?? "Ukjent"),
        per_aktivitet: tally((r) => String(r.activity ?? "")),
        siste: rows.slice(0, 30).map((r) => ({
          deltaker: partName.get(r.participant_id) ?? null,
          aktivitet: r.activity,
          leder: leaderName.get(r.registered_by) ?? null,
          tidspunkt: r.completed_at,
        })),
      };
    },
  },
  {
    name: "ledere",
    description: "Aktive ledere: navn, lag, hytte, ministerpost og sertifiseringer (klatring, rappis, taubane, båtførerbevis, førerkort).",
    inputSchema: { type: "object", properties: { sok: { type: "string", description: "Del av navnet" } } },
    run: async (db, args) => {
      const sok = str(args.sok).replace(/[%,()]/g, "");
      let q = db
        .from("leaders")
        .select("id, name, team, cabin, ministerpost, is_external, can_climbing, can_rappelling, can_rope_setup, can_zipline, has_boat_license, has_drivers_license")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (sok) q = q.ilike("name", `%${sok}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((l) => ({
        id: l.id,
        navn: l.name,
        lag: l.team ?? null,
        hytte: l.cabin ?? null,
        ministerpost: l.ministerpost ?? null,
        ekstern: !!l.is_external,
        kan: [
          l.can_climbing && "klatring",
          l.can_rappelling && "rappis",
          l.can_rope_setup && "taurigging",
          l.can_zipline && "taubane",
          l.has_boat_license && "båtførerbevis",
          l.has_drivers_license && "førerkort",
        ].filter(Boolean),
      }));
    },
  },
  {
    name: "gomla",
    description: "Gomla (kiosken) i perioden: antall salg, sum, mest solgte varer og sum per deltaker.",
    inputSchema: {
      type: "object",
      properties: { ...periodeProp, per_deltaker: { type: "boolean", description: "Ta med sum per deltaker" } },
    },
    run: async (db, args) => {
      const p = await resolvePeriod(db, args.periode);
      const sales = await fetchAll(() => db.from("kiosk_sales").select("id, participant_id, total, created_at").eq("period_id", p.id).is("voided_at", null));
      const ids = new Set(sales.map((s) => s.id));
      const items = sales.length
        ? (await fetchAll(() => db.from("kiosk_sale_items").select("sale_id, product_name, quantity, unit_price"))).filter((i) => ids.has(i.sale_id))
        : [];
      const products = new Map<string, { antall: number; sum_kr: number }>();
      for (const i of items) {
        const cur = products.get(i.product_name) ?? { antall: 0, sum_kr: 0 };
        cur.antall += Number(i.quantity ?? 0);
        cur.sum_kr += Number(i.quantity ?? 0) * Number(i.unit_price ?? 0);
        products.set(i.product_name, cur);
      }
      // deno-lint-ignore no-explicit-any
      const out: Record<string, any> = {
        periode: periodOut(p),
        antall_salg: sales.length,
        sum_kr: sales.reduce((s, r) => s + Number(r.total ?? 0), 0),
        varer: [...products.entries()].map(([vare, v]) => ({ vare, ...v })).sort((a, b) => b.antall - a.antall).slice(0, 40),
      };
      if (args.per_deltaker === true) {
        const parts = await fetchAll(() => db.from("participants").select("id, name").eq("period_id", p.id));
        const name = new Map(parts.map((x) => [x.id, x.name]));
        const per = new Map<string, number>();
        for (const s of sales) per.set(s.participant_id, (per.get(s.participant_id) ?? 0) + Number(s.total ?? 0));
        out.per_deltaker = [...per.entries()]
          .map(([id, sum_kr]) => ({ navn: name.get(id) ?? "Ukjent", sum_kr }))
          .sort((a, b) => b.sum_kr - a.sum_kr);
      }
      return out;
    },
  },
];

const SERVICE_NAME = "oksnoen-lederapp";
// ---------- Datakart: alle åpne tabeller ----------
//
// Admin og assistentene skal kunne lese alt i denne appen (bestemt av August
// 16.11.2026). «datakart» viser hva som finnes, «rader» leser én tabell.
// Listen er laget fra databasetypene. En ny tabell må legges til her for å bli
// synlig. Kolonner som ikke står i listen, forlater aldri databasen.
//
// Holdt utenfor: PIN-koder, push-nøkler og appens innstillinger (hemmeligheter), og det sosiale
// mellom lederne (sveip, match, meldinger og spill), som ledelsen heller ikke ser i appen.

interface OpenTable {
  /** Område. */
  o: string;
  /** Hva tabellen inneholder. */
  h: string;
  /** Kolonnene som kan leses. */
  k: string[];
}

const TABELLER: Record<string, OpenTable> = {
  "participants": {
    "o": "Deltakere og opphold",
    "h": "Deltakere per periode: navn, fødselsdato, hytte, rom, lag, bilde, notater, pass-tekst og fast person_id",
    "k": [
      "activity_notes",
      "birth_date",
      "cabin_id",
      "created_at",
      "first_name",
      "gift_card_number",
      "has_arrived",
      "arrived_at",
      "arrived_by",
      "id",
      "image_aged_url",
      "image_thumb_url",
      "image_url",
      "insj_points",
      "last_name",
      "name",
      "notes",
      "pass_suggestion",
      "pass_text",
      "pass_written",
      "pass_written_at",
      "pass_written_by",
      "period_id",
      "person_id",
      "room",
      "team_id",
      "times_attended",
      "updated_at"
    ]
  },
  "participant_bookings": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "address",
      "birth_date",
      "booking_time",
      "cancelled_date",
      "created_at",
      "discount",
      "first_name",
      "friends",
      "gender",
      "guardian_email",
      "guardian_first_name",
      "guardian_last_name",
      "guardian_phone",
      "id",
      "invoiced_date",
      "kiosk_money",
      "last_name",
      "notes_info",
      "paid_date",
      "participant_id",
      "payment_reference",
      "payment_status",
      "period_id",
      "period_label",
      "person_id",
      "postal_city",
      "postal_code",
      "prepayment",
      "price",
      "reservation_code",
      "reservation_number",
      "seat_confirmed",
      "status",
      "sweater_size",
      "times_attended",
      "updated_at"
    ]
  },
  "participant_teams": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "bonus_points",
      "color",
      "created_at",
      "id",
      "name",
      "period_id",
      "slot",
      "updated_at"
    ]
  },
  "participant_bonus_points": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "activity_key",
      "activity_label",
      "awarded_by",
      "created_at",
      "id",
      "participant_id",
      "period_id",
      "points",
      "team_id",
      "variant"
    ]
  },
  "participant_sweaters": {
    "o": "Deltakere og opphold",
    "h": "Gensere: forhåndsbestilt, kjøpt på leir og hentet",
    "k": [
      "bought_at",
      "bought_on_camp",
      "bought_size",
      "created_at",
      "id",
      "participant_id",
      "period_id",
      "picked_up",
      "picked_up_at",
      "picked_up_size",
      "preordered_size",
      "updated_at"
    ]
  },
  "participant_tasks": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "claimed_at",
      "claimed_by",
      "completed_at",
      "created_at",
      "created_by",
      "id",
      "is_broadcast",
      "message",
      "participant_id",
      "period_id",
      "read_at",
      "read_by",
      "status",
      "target_leader_id",
      "updated_at"
    ]
  },
  "wristband_assignments": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "assigned_at",
      "assigned_by",
      "code",
      "created_at",
      "id",
      "participant_id",
      "period_id",
      "release_reason",
      "released_at",
      "updated_at"
    ]
  },
  "cabins": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "created_at",
      "id",
      "name",
      "sort_order"
    ]
  },
  "room_capacity": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "bed_count",
      "cabin_id",
      "created_at",
      "id",
      "room"
    ]
  },
  "participant_arrival_log": {
    "o": "Deltakere og opphold",
    "h": "Historikk over ankomst: hvert barn som ble markert som ankommet eller fikk ankomsten fjernet, med hvem og når",
    "k": ["arrived", "changed_at", "changed_by", "id", "participant_id", "period_id"]
  },
  "session_log": {
    "o": "Aktiviteter",
    "h": "Øktene dag for dag: aktiv økt (1–3) og aktivitetene i hver økt, hver gang admin lagret dem",
    "k": ["active_session", "id", "log_date", "period_id", "saved_at", "saved_by", "sessions"]
  },
  "change_log": {
    "o": "Historikk",
    "h": "Endringslogg: gammel og ny verdi for deltakere, aktiviteter, helse, hendelser, rombytter, hytterapporter, Gomla, armbånd, ledere i perioden og vakter",
    "k": ["action", "changed_at", "changed_by", "id", "new_data", "old_data", "row_id", "table_name"]
  },
  "room_swaps": {
    "o": "Deltakere og opphold",
    "h": "Rombytter med begrunnelse og hvem som godkjente",
    "k": [
      "approved_at",
      "approved_by",
      "created_at",
      "from_cabin_id",
      "from_room",
      "id",
      "participant_id",
      "period_id",
      "reason",
      "status",
      "to_cabin_id",
      "to_room"
    ]
  },
  "cabin_reports": {
    "o": "Deltakere og opphold",
    "h": "Hytterapporter skrevet av lederne",
    "k": [
      "cabin_id",
      "content",
      "id",
      "period_id",
      "updated_at",
      "updated_by"
    ]
  },
  "leader_cabins": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "cabin_id",
      "created_at",
      "id",
      "leader_id"
    ]
  },
  "extra_fields_config": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "created_at",
      "field_key",
      "icon",
      "id",
      "is_visible",
      "sort_order",
      "title",
      "updated_at"
    ]
  },
  "booking_edit_log": {
    "o": "Deltakere og opphold",
    "h": "",
    "k": [
      "booking_id",
      "changed_by",
      "changed_by_name",
      "created_at",
      "field_name",
      "id",
      "new_value",
      "old_value",
      "participant_name",
      "period_id"
    ]
  },
  "activities": {
    "o": "Aktiviteter",
    "h": "",
    "k": [
      "created_at",
      "id",
      "is_active",
      "sort_order",
      "title"
    ]
  },
  "participant_activities": {
    "o": "Aktiviteter",
    "h": "",
    "k": [
      "activity",
      "client_scan_id",
      "completed_at",
      "id",
      "participant_id",
      "period_id",
      "registered_by",
      "scanned_at",
      "source",
      "wristband_code"
    ]
  },
  "session_activities": {
    "o": "Aktiviteter",
    "h": "",
    "k": [
      "created_at",
      "description",
      "id",
      "is_active",
      "sort_order",
      "time_slot",
      "title"
    ]
  },
  "participant_health_info": {
    "o": "Sykepleier og hendelser",
    "h": "Helseinfo per deltaker (fra booking og sykepleier)",
    "k": [
      "created_at",
      "id",
      "info",
      "participant_id",
      "period_id",
      "updated_at"
    ]
  },
  "participant_health_notes": {
    "o": "Sykepleier og hendelser",
    "h": "Sykepleierens notater per deltaker",
    "k": [
      "content",
      "created_at",
      "created_by",
      "id",
      "participant_id",
      "period_id",
      "updated_at"
    ]
  },
  "participant_health_events": {
    "o": "Sykepleier og hendelser",
    "h": "Helsehendelser: type, alvorlighet og beskrivelse",
    "k": [
      "created_at",
      "created_by",
      "description",
      "event_type",
      "id",
      "participant_id",
      "period_id",
      "severity"
    ]
  },
  "participant_incidents": {
    "o": "Sykepleier og hendelser",
    "h": "Hendelser med deltakere, meldt av ledere",
    "k": [
      "category",
      "created_at",
      "description",
      "id",
      "leader_id",
      "period_id",
      "severity",
      "title",
      "updated_at"
    ]
  },
  "participant_incident_participants": {
    "o": "Sykepleier og hendelser",
    "h": "",
    "k": [
      "created_at",
      "incident_id",
      "participant_id"
    ]
  },
  "nurse_reports": {
    "o": "Sykepleier og hendelser",
    "h": "Sykepleierens rapporter per periode",
    "k": [
      "content",
      "created_at",
      "created_by",
      "id",
      "period_id",
      "updated_at"
    ]
  },
  "nurse_incident_reviews": {
    "o": "Sykepleier og hendelser",
    "h": "",
    "k": [
      "created_at",
      "id",
      "incident_id",
      "mention_ids",
      "reviewed_at",
      "reviewed_by",
      "status",
      "updated_at"
    ]
  },
  "nurse_report_mentions": {
    "o": "Sykepleier og hendelser",
    "h": "",
    "k": [
      "created_at",
      "id",
      "mention_text",
      "participant_id",
      "report_id"
    ]
  },
  "kiosk_sales": {
    "o": "Gomla",
    "h": "",
    "k": [
      "client_ref",
      "created_at",
      "id",
      "participant_id",
      "period_id",
      "sale_number",
      "sold_by",
      "total",
      "updated_at",
      "voided_at",
      "voided_by"
    ]
  },
  "kiosk_sale_items": {
    "o": "Gomla",
    "h": "",
    "k": [
      "created_at",
      "id",
      "product_id",
      "product_name",
      "quantity",
      "sale_id",
      "unit_price"
    ]
  },
  "kiosk_deposits": {
    "o": "Gomla",
    "h": "Innskudd og justeringer av kioskpenger per deltaker",
    "k": [
      "amount",
      "created_at",
      "created_by",
      "id",
      "kind",
      "note",
      "participant_id",
      "period_id",
      "updated_at"
    ]
  },
  "kiosk_products": {
    "o": "Gomla",
    "h": "",
    "k": [
      "category_id",
      "color",
      "created_at",
      "id",
      "is_active",
      "name",
      "price",
      "sort_order",
      "updated_at"
    ]
  },
  "kiosk_categories": {
    "o": "Gomla",
    "h": "",
    "k": [
      "color",
      "created_at",
      "id",
      "is_active",
      "name",
      "sort_order",
      "updated_at"
    ]
  },
  "leaders": {
    "o": "Ledere",
    "h": "Ledere: navn, telefon, e-post, lag, hytte, ministerpost og sertifiseringer",
    "k": [
      "age",
      "cabin",
      "cabin_info",
      "can_climbing",
      "can_rappelling",
      "can_rope_setup",
      "can_zipline",
      "created_at",
      "deleted_at",
      "deleted_by",
      "email",
      "gender",
      "has_boat_license",
      "has_car",
      "has_drivers_license",
      "has_seen_push_prompt",
      "id",
      "is_active",
      "is_external",
      "last_app_edit_at",
      "last_synced_at",
      "leirskole_competencies",
      "leirskole_competencies_confirmed_at",
      "ministerpost",
      "name",
      "phone",
      "profile_image_aged_url",
      "profile_image_url",
      "team",
      "updated_at"
    ]
  },
  "user_roles": {
    "o": "Ledere",
    "h": "",
    "k": [
      "id",
      "leader_id",
      "role"
    ]
  },
  "leader_teams": {
    "o": "Ledere",
    "h": "",
    "k": [
      "created_at",
      "id",
      "leader_id",
      "period_number",
      "team",
      "year"
    ]
  },
  "leader_service_periods": {
    "o": "Ledere",
    "h": "Hvilke perioder hver leder har jobbet, per år",
    "k": [
      "created_at",
      "id",
      "leader_id",
      "period_code",
      "year"
    ]
  },
  "leader_period_history": {
    "o": "Ledere",
    "h": "",
    "k": [
      "created_at",
      "id",
      "leader_id",
      "note",
      "period_id",
      "source",
      "updated_at"
    ]
  },
  "period_leaders": {
    "o": "Ledere",
    "h": "",
    "k": [
      "created_at",
      "id",
      "leader_id",
      "max_hours_per_day",
      "notes",
      "period_id",
      "period_number",
      "status",
      "updated_at"
    ]
  },
  "period_leader_assignments": {
    "o": "Ledere",
    "h": "",
    "k": [
      "created_at",
      "id",
      "leader_id",
      "period_id"
    ]
  },
  "period_leader_snapshots": {
    "o": "Ledere",
    "h": "",
    "k": [
      "cabins",
      "created_at",
      "gender",
      "id",
      "is_active",
      "is_external",
      "leader_id",
      "leader_name",
      "period_id",
      "roles",
      "snapshot_at",
      "teams",
      "updated_at"
    ]
  },
  "leader_content": {
    "o": "Ledere",
    "h": "",
    "k": [
      "current_activity",
      "extra_1",
      "extra_2",
      "extra_3",
      "extra_4",
      "extra_5",
      "extra_activity",
      "has_read",
      "has_seen_hajolo_tooltip",
      "id",
      "last_app_edit_at",
      "last_synced_at",
      "leader_id",
      "obs_message",
      "personal_message",
      "personal_notes",
      "updated_at"
    ]
  },
  "leader_deviations": {
    "o": "Ledere",
    "h": "",
    "k": [
      "created_at",
      "created_by",
      "hours",
      "id",
      "kind",
      "leader_id",
      "note",
      "occurred_on",
      "period_id",
      "updated_at"
    ]
  },
  "leader_availability": {
    "o": "Ledere",
    "h": "",
    "k": [
      "available",
      "created_at",
      "date",
      "from_time",
      "id",
      "note",
      "period_leader_id",
      "to_time",
      "updated_at"
    ]
  },
  "admin_notes": {
    "o": "Ledere",
    "h": "",
    "k": [
      "content",
      "created_at",
      "created_by",
      "id",
      "is_pinned",
      "kind",
      "strokes",
      "title",
      "updated_at",
      "updated_by"
    ]
  },
  "special_duties": {
    "o": "Ledere",
    "h": "",
    "k": [
      "created_at",
      "day_index",
      "duty_type",
      "id",
      "leader_id",
      "schedule_id"
    ]
  },
  "shift_types": {
    "o": "Vaktplan",
    "h": "Vakttyper med tidspunkt og bemanningskrav",
    "k": [
      "all_must_attend",
      "created_at",
      "day_type",
      "duration_hours",
      "end_time",
      "id",
      "min_leaders",
      "name",
      "requires_18_plus",
      "slug",
      "sort_order",
      "start_time"
    ]
  },
  "shift_assignments": {
    "o": "Vaktplan",
    "h": "Vakter: hvem som har hvilken vakt hvilken dag",
    "k": [
      "assignment_type",
      "created_at",
      "day_index",
      "day_type",
      "excluded_leader_ids",
      "id",
      "is_locked",
      "leader_id",
      "note",
      "role",
      "schedule_id",
      "shift_type_id",
      "team_name",
      "updated_at"
    ]
  },
  "shift_schedules": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "generated_at",
      "generated_by",
      "id",
      "is_published",
      "period_id",
      "period_length",
      "period_number",
      "start_date",
      "status",
      "updated_at",
      "year"
    ]
  },
  "shift_planner_mini_shifts": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "created_at",
      "end_time",
      "id",
      "min_leaders",
      "name",
      "sort_order",
      "start_time",
      "updated_at"
    ]
  },
  "shift_planner_mini_assignments": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "created_at",
      "day_index",
      "id",
      "leader_id",
      "shift_id"
    ]
  },
  "schedule_posts": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "created_at",
      "date",
      "duration_hours",
      "end_time",
      "id",
      "is_breakfast",
      "is_main_session",
      "is_night",
      "name",
      "notes",
      "required_leaders",
      "schedule_id",
      "shift_type_id",
      "slug",
      "sort_order",
      "start_time",
      "updated_at"
    ]
  },
  "schedule_post_assignments": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "assigned_at",
      "assigned_manually",
      "created_at",
      "generator_run_id",
      "id",
      "is_locked",
      "period_leader_id",
      "post_id",
      "updated_at"
    ]
  },
  "schedule_generator_runs": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "created_at",
      "id",
      "keep_locked",
      "run_at",
      "run_by",
      "schedule_id",
      "stats"
    ]
  },
  "team_kitchen_duty": {
    "o": "Vaktplan",
    "h": "",
    "k": [
      "created_at",
      "id",
      "manual_override_date",
      "manual_override_slot_a",
      "manual_override_slot_b",
      "period_id",
      "rotation_start_date",
      "updated_at"
    ]
  },
  "leirskole_weeks": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "created_at",
      "end_date",
      "external_ref",
      "group_count",
      "id",
      "is_active",
      "max_daily_hours",
      "min_rest_hours",
      "name",
      "notes",
      "schedule_published_at",
      "start_date",
      "updated_at"
    ]
  },
  "leirskole_week_days": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "created_at",
      "date",
      "day_type",
      "id",
      "is_locked",
      "log_note",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_week_plan_cells": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "color",
      "content",
      "created_at",
      "date",
      "id",
      "post_id",
      "row_index",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_week_leader_snapshots": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "activities",
      "activity_count",
      "competencies",
      "created_at",
      "hours",
      "id",
      "kitchen_days",
      "kitchen_hours",
      "leader_id",
      "leader_name",
      "role_label",
      "shift_count",
      "snapshot_at",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_posts": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "created_at",
      "crosses_midnight",
      "date",
      "duration_hours",
      "end_time",
      "id",
      "is_custom",
      "is_main_shift",
      "is_night",
      "is_published",
      "name",
      "notes",
      "post_type",
      "required_leaders",
      "sort_order",
      "start_time",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_assignments": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "assigned_at",
      "assigned_manually",
      "created_at",
      "generator_run_id",
      "id",
      "is_locked",
      "note",
      "post_id",
      "staff_id",
      "updated_at"
    ]
  },
  "leirskole_staff": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "created_at",
      "external_ref",
      "id",
      "leader_id",
      "max_daily_hours",
      "role_label",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_availability": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "available",
      "created_at",
      "date",
      "from_time",
      "id",
      "note",
      "staff_id",
      "to_time",
      "updated_at"
    ]
  },
  "leirskole_activity_types": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "created_at",
      "emoji",
      "id",
      "is_active",
      "is_custom",
      "key",
      "label",
      "sort_order",
      "updated_at"
    ]
  },
  "leirskole_activity_assignments": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "activity",
      "auto_generated",
      "created_at",
      "created_by",
      "date",
      "id",
      "leader_id",
      "note",
      "session",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_session_activities": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "activity_keys",
      "created_at",
      "date",
      "id",
      "session",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_group_requirements": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "activity_key",
      "created_at",
      "required_count",
      "sort_order",
      "updated_at"
    ]
  },
  "leirskole_group_completions": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "activity_key",
      "created_at",
      "created_by",
      "date",
      "group_number",
      "id",
      "note",
      "session",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_kitchen_days": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "created_at",
      "date",
      "hours",
      "id",
      "note",
      "staff_id",
      "updated_at",
      "week_id"
    ]
  },
  "leirskole_generator_runs": {
    "o": "Leirskole",
    "h": "",
    "k": [
      "finished_at",
      "id",
      "keep_locked",
      "run_by",
      "started_at",
      "stats",
      "status",
      "week_id"
    ]
  },
  "fix_tasks": {
    "o": "Drift",
    "h": "FIX: vedlikeholdsoppgaver med sted, status og hvem som fikset",
    "k": [
      "admin_notes",
      "assigned_at",
      "assigned_to",
      "created_at",
      "created_by",
      "description",
      "fixed_at",
      "fixed_by",
      "id",
      "image_url",
      "location",
      "period_id",
      "status",
      "title",
      "updated_at",
      "what_to_fix"
    ]
  },
  "rope_controls": {
    "o": "Drift",
    "h": "Taukontroller",
    "k": [
      "activity",
      "assigned_to",
      "carabiner_comment",
      "carabiner_status",
      "created_at",
      "fix_comment",
      "fixed_at",
      "fixed_by",
      "harness_comment",
      "harness_status",
      "helmet_comment",
      "helmet_status",
      "id",
      "leader_id",
      "period_id",
      "rope_comment",
      "rope_status",
      "updated_at"
    ]
  },
  "kitchen_sections": {
    "o": "Drift",
    "h": "",
    "k": [
      "body",
      "created_at",
      "icon",
      "id",
      "kind",
      "slug",
      "sort_order",
      "subtitle",
      "title",
      "updated_at"
    ]
  },
  "kitchen_items": {
    "o": "Drift",
    "h": "",
    "k": [
      "created_at",
      "hint",
      "id",
      "label",
      "section_id",
      "sort_order",
      "updated_at"
    ]
  },
  "kitchen_item_checks": {
    "o": "Drift",
    "h": "",
    "k": [
      "checked_at",
      "checked_by",
      "created_at",
      "id",
      "item_id",
      "period_id",
      "updated_at"
    ]
  },
  "gjenglemt_items": {
    "o": "Drift",
    "h": "Gjenglemte ting med bilde, beskrivelse og eier",
    "k": [
      "ai_description",
      "ai_status",
      "ai_tags",
      "bag_label",
      "color",
      "comment",
      "created_at",
      "created_by",
      "garment_type",
      "id",
      "image_url",
      "item_number",
      "notes",
      "owner_name",
      "period_id",
      "status",
      "updated_at"
    ]
  },
  "dynga_columns": {
    "o": "Drift",
    "h": "",
    "k": [
      "color",
      "created_at",
      "id",
      "period_id",
      "sort_order",
      "title"
    ]
  },
  "dynga_cards": {
    "o": "Drift",
    "h": "Dynga: kort på tavla",
    "k": [
      "column_id",
      "created_at",
      "id",
      "participant_id",
      "period_id",
      "sort_order",
      "updated_at"
    ]
  },
  "dynga_comments": {
    "o": "Drift",
    "h": "",
    "k": [
      "body",
      "card_id",
      "created_at",
      "id",
      "leader_id"
    ]
  },
  "announcements": {
    "o": "Beskjeder",
    "h": "Oppslag til lederne",
    "k": [
      "content",
      "created_at",
      "id",
      "is_active",
      "period_id",
      "target_group",
      "title"
    ]
  },
  "chat_messages": {
    "o": "Beskjeder",
    "h": "Lederchatten",
    "k": [
      "body",
      "channel",
      "created_at",
      "id",
      "image_path",
      "leader_id",
      "mentions",
      "period_id",
      "reply_to_id"
    ]
  },
  "chat_message_reactions": {
    "o": "Beskjeder",
    "h": "",
    "k": [
      "created_at",
      "emoji",
      "id",
      "leader_id",
      "message_id"
    ]
  },
  "chat_mention_notifications": {
    "o": "Beskjeder",
    "h": "",
    "k": [
      "created_at",
      "message_id"
    ]
  },
  "mailbox_messages": {
    "o": "Beskjeder",
    "h": "Postkassen fra ledere til ledelsen. Avsender er skjult på anonyme meldinger",
    "k": [
      "admin_reply",
      "category",
      "content",
      "created_at",
      "id",
      "is_anonymous",
      "period_id",
      "read_at",
      "replied_at",
      "replied_by",
      "reply_seen_at",
      "sender_leader_id",
      "status",
      "updated_at"
    ]
  },
  "overnatting_responses": {
    "o": "Beskjeder",
    "h": "",
    "k": [
      "created_at",
      "is_joining",
      "leader_id",
      "updated_at"
    ]
  },
  "feedback_items": {
    "o": "Beskjeder",
    "h": "",
    "k": [
      "admin_reply",
      "category",
      "created_at",
      "description",
      "id",
      "leader_id",
      "status",
      "title",
      "updated_at"
    ]
  },
  "feedback_votes": {
    "o": "Beskjeder",
    "h": "",
    "k": [
      "created_at",
      "feedback_id",
      "leader_id"
    ]
  },
  "stories": {
    "o": "Beskjeder",
    "h": "",
    "k": [
      "content",
      "created_at",
      "id",
      "is_active",
      "period_id",
      "sort_order",
      "title",
      "updated_at"
    ]
  },
  "pov_rolls": {
    "o": "Bilder",
    "h": "",
    "k": [
      "created_at",
      "created_by",
      "developed_at",
      "id",
      "reveal_at",
      "season_year",
      "shots_per_leader",
      "status",
      "title",
      "updated_at"
    ]
  },
  "pov_photos": {
    "o": "Bilder",
    "h": "POV-bilder tatt av ledere",
    "k": [
      "created_at",
      "hidden",
      "id",
      "leader_id",
      "roll_id",
      "storage_path",
      "taken_at",
      "updated_at"
    ]
  },
  "pov_photo_reactions": {
    "o": "Bilder",
    "h": "",
    "k": [
      "created_at",
      "id",
      "leader_id",
      "photo_id"
    ]
  },
  "periods": {
    "o": "System",
    "h": "",
    "k": [
      "archived_at",
      "created_at",
      "end_date",
      "id",
      "is_active",
      "is_public",
      "name",
      "season_year",
      "slug",
      "start_date",
      "updated_at"
    ]
  },
  "home_screen_config": {
    "o": "System",
    "h": "",
    "k": [
      "bg_color",
      "element_key",
      "icon",
      "id",
      "is_bold",
      "is_italic",
      "is_visible",
      "label",
      "sort_order",
      "text_size",
      "title"
    ]
  },
  "hub_api_log": {
    "o": "System",
    "h": "",
    "k": [
      "args",
      "created_at",
      "duration_ms",
      "id",
      "ok",
      "tool",
      "via"
    ]
  }
};

const HOLDT_UTENFOR = {
  "admin_pins": "PIN-koder",
  "app_config": "Innstillinger som kan inneholde hemmeligheter",
  "hookup_notifications": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "leader_hookups": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "leader_match_messages": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "leader_matches": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "leader_sips": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "leader_swipes": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "murder_death_notifications": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "murder_games": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "murder_kill_claims": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "murder_players": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "murder_round_snapshots": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "push_subscriptions": "Push-nøkler",
  "roulette_assignments": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "roulette_tasks": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "secret_word_assignments": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "secret_word_matches": "Sosialt mellom lederne, som ledelsen ikke ser i appen",
  "secret_word_pairs": "Sosialt mellom lederne, som ledelsen ikke ser i appen"
};

/** Kolonner som peker på en annen rad, og hvor navnet finnes. */
const REFS: Record<string, { t: string; k: string; n: string[] }> = {
  "participant_id": {
    "t": "participants",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "cabin_id": {
    "t": "cabins",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "from_cabin_id": {
    "t": "cabins",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "to_cabin_id": {
    "t": "cabins",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "period_id": {
    "t": "periods",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "team_id": {
    "t": "participant_teams",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "shift_type_id": {
    "t": "shift_types",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "product_id": {
    "t": "kiosk_products",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "category_id": {
    "t": "kiosk_categories",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "leader_id": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "created_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "registered_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "updated_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "approved_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "assigned_to": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "assigned_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "fixed_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "sold_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "voided_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "pass_written_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "awarded_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "claimed_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "read_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "target_leader_id": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "sender_leader_id": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "replied_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "deleted_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "reviewed_by": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "mentioned_leader_id": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  },
  "author_id": {
    "t": "leaders",
    "k": "id",
    "n": [
      "name"
    ]
  }
};

const TIME_COLS = ["saved_at", "created_at", "completed_at", "scanned_at", "changed_at", "work_date", "date", "updated_at"];

/** Legger navn ved siden av ID-er, så svaret kan leses uten flere oppslag. */
// deno-lint-ignore no-explicit-any
async function withNames(db: Db, rows: any[]): Promise<any[]> {
  if (rows.length === 0) return rows;
  const cols = Object.keys(rows[0]).filter((c) => REFS[c]);
  const byTarget = new Map<string, Set<string>>();
  for (const c of cols) {
    const key = `${REFS[c].t}|${REFS[c].k}`;
    const set = byTarget.get(key) ?? new Set<string>();
    for (const r of rows) if (typeof r[c] === "string" && r[c]) set.add(r[c]);
    byTarget.set(key, set);
  }
  const names = new Map<string, Map<string, string>>();
  for (const [key, ids] of byTarget) {
    const [table, idCol] = key.split("|");
    const ref = Object.values(REFS).find((x) => x.t === table && x.k === idCol)!;
    const map = new Map<string, string>();
    const all = [...ids];
    for (let i = 0; i < all.length; i += 200) {
      const { data } = await db.from(table).select(`${idCol}, ${ref.n.join(", ")}`).in(idCol, all.slice(i, i + 200));
      // deno-lint-ignore no-explicit-any
      for (const row of (data ?? []) as any[]) {
        map.set(row[idCol], ref.n.map((n) => row[n]).filter(Boolean).join(" "));
      }
    }
    names.set(key, map);
  }
  return rows.map((r) => {
    const out = { ...r };
    for (const c of cols) {
      const name = names.get(`${REFS[c].t}|${REFS[c].k}`)?.get(r[c]);
      if (name) out[`${c.replace(/_id$/, "")}_navn`] = name;
    }
    return out;
  });
}

tools.push(
  {
    name: "datakart",
    sample: () => Promise.resolve({}),
    description:
      "Oversikt over alt som kan leses i denne appen: hvert område med tabellene, hva de inneholder og hvilke kolonner de har. Start her når du ikke vet hvor noe ligger, og les så med verktøyet rader. Kan begrenses til ett område, og kan ta med antall rader.",
    inputSchema: {
      type: "object",
      properties: {
        omraade: { type: "string", description: "Del av områdenavnet, f.eks. «vaktplan»" },
        med_antall: { type: "boolean", description: "Ta med antall rader per tabell (tregere)" },
        kontroller: { type: "boolean", description: "Prøv å lese hver tabell, og meld hvilke som feiler" },
      },
    },
    run: async (db, args) => {
      const want = str(args.omraade).toLowerCase();
      const names = Object.keys(TABELLER).filter((n) => !want || TABELLER[n].o.toLowerCase().includes(want));
      if (args.kontroller === true) {
        const feil: { tabell: string; feil: string }[] = [];
        for (let i = 0; i < names.length; i += 12) {
          await Promise.all(
            names.slice(i, i + 12).map(async (n) => {
              const { error } = await db.from(n).select(TABELLER[n].k.join(", ")).limit(1);
              if (error) feil.push({ tabell: n, feil: error.message });
            }),
          );
        }
        return { kontrollert: names.length, ok: feil.length === 0, feil };
      }
      const counts = new Map<string, number | null>();
      if (args.med_antall === true) {
        for (let i = 0; i < names.length; i += 12) {
          await Promise.all(
            names.slice(i, i + 12).map(async (n) => {
              const { count, error } = await db.from(n).select("*", { count: "exact", head: true });
              counts.set(n, error ? null : (count ?? 0));
            }),
          );
        }
      }
      const areas = new Map<string, unknown[]>();
      for (const n of names) {
        const t = TABELLER[n];
        const list = areas.get(t.o) ?? [];
        list.push({ tabell: n, ...(t.h ? { hva: t.h } : {}), kolonner: t.k, ...(counts.has(n) ? { rader: counts.get(n) } : {}) });
        areas.set(t.o, list);
      }
      return {
        omraader: [...areas.entries()].map(([omraade, tabeller]) => ({ omraade, tabeller })),
        holdt_utenfor: HOLDT_UTENFOR,
      };
    },
  },
  {
    name: "rader",
    sample: () => Promise.resolve({ tabell: "activities", maks: 1 }),
    description:
      "Leser rader fra én tabell i datakartet, nyeste først. ID-er får navn ved siden av seg (deltaker, leder, hytte, periode). Kan begrenses til én periode, og søke i innholdet. Bruk datakart først for å finne riktig tabell.",
    inputSchema: {
      type: "object",
      required: ["tabell"],
      properties: {
        tabell: { type: "string", description: "Navnet på tabellen, fra datakart" },
        periode: { type: "string", description: "Periodens id, slug eller navn. Utelat for alle perioder" },
        sok: { type: "string", description: "Tekst som må finnes i raden, også i navnene" },
        maks: { type: "number", description: "Maks antall rader, standard 100, høyst 1000" },
      },
    },
    run: async (db, args) => {
      const name = str(args.tabell);
      const t = TABELLER[name];
      if (!t) throw new Error(`Tabellen «${name}» er ikke åpen. Bruk datakart for å se hvilke som finnes.`);
      const maks = num(args.maks, 100, 1, 1000);
      const sok = str(args.sok, 120).toLowerCase();
      // deno-lint-ignore no-explicit-any
      const filters: ((q: any) => any)[] = [];
      if (str(args.periode)) {
        if (!t.k.includes("period_id")) throw new Error(`Tabellen «${name}» er ikke delt på perioder.`);
        const p = await resolvePeriod(db, args.periode);
        filters.push((q) => q.eq("period_id", p.id));
      }
      const timeCol = TIME_COLS.find((c) => t.k.includes(c));
      const build = () => {
        let q = db.from(name).select(t.k.join(", "));
        for (const f of filters) q = f(q);
        if (timeCol) q = q.order(timeCol, { ascending: false });
        return q;
      };
      // deno-lint-ignore no-explicit-any
      let rows: any[];
      if (sok) {
        rows = await fetchAll(build, 5000);
      } else {
        const { data, error } = await build().limit(maks + 1);
        if (error) throw new Error(error.message);
        rows = data ?? [];
      }
      // Postkassen lover anonymitet. Avsender følger aldri med på anonyme meldinger.
      if (name === "mailbox_messages") {
        rows = rows.map((r) => (r.is_anonymous ? { ...r, sender_leader_id: null } : r));
      }
      rows = await withNames(db, rows);
      if (sok) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(sok));
      return {
        tabell: name,
        omraade: t.o,
        antall_vist: Math.min(rows.length, maks),
        flere_finnes: rows.length > maks,
        rader: rows.slice(0, maks),
      };
    },
  },
);


// ---------- Nye bilder: huben henter og lagrer bildene av barna ----------
//
// Hver gang et bilde av en deltaker legges inn eller byttes, setter databasen
// image_changed_at. Huben spør etter alt som er endret siden sist den spurte, og
// lagrer bildet på barnet i sitt eget register. Svaret er sortert eldst først, så
// huben kan fortsette fra siste «endret» uten å miste noe.
tools.push({
  name: "nye_bilder",
  description:
    "Bilder av deltakere som er lagt inn eller byttet siden et tidspunkt, eldst først: person_id, navn, fødselsdato, perioden og år, lenke til bildet og når det ble endret. Uten «siden» kommer alle.",
  inputSchema: {
    type: "object",
    properties: {
      siden: { type: "string", description: "ISO-tidspunkt. Bare bilder endret etter dette." },
      maks: { type: "number", description: "Maks antall, standard 200, høyst 500" },
    },
  },
  run: async (db, args) => {
    const maks = num(args.maks, 200, 1, 500);
    const siden = str(args.siden);
    if (siden && Number.isNaN(Date.parse(siden))) throw new Error("«siden» må være et ISO-tidspunkt.");
    let q = db
      .from("participants")
      .select("id, person_id, name, first_name, last_name, birth_date, image_url, image_thumb_url, image_changed_at, periods(id, name, season_year)")
      .not("image_changed_at", "is", null)
      .or("image_url.not.is.null,image_thumb_url.not.is.null")
      .order("image_changed_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maks + 1);
    if (siden) q = q.gt("image_changed_at", siden);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // deno-lint-ignore no-explicit-any
    const rows = (data ?? []) as any[];
    return {
      antall: Math.min(rows.length, maks),
      flere_finnes: rows.length > maks,
      bilder: rows.slice(0, maks).map((r) => ({
        deltakelse_id: r.id,
        person_id: r.person_id ?? null,
        navn: r.name,
        fornavn: r.first_name ?? null,
        etternavn: r.last_name ?? null,
        fodselsdato: r.birth_date ?? null,
        periode: r.periods ? { id: r.periods.id, navn: r.periods.name, aar: r.periods.season_year } : null,
        bilde: r.image_url ?? r.image_thumb_url,
        miniatyr: r.image_thumb_url ?? null,
        endret: r.image_changed_at,
      })),
    };
  },
});


// ---------- Helse for ett barn: bare når admin trykker på det ----------
//
// Sykepleierinfo for én deltakelse, aldri for mange barn i ett kall. Huben viser
// det bare i barnets profil, etter at admin har trykket «Vis helse», og det er ikke
// et verktøy for AI-assistentene. Oppslaget logges i hub_api_log som alle andre.
tools.push({
  name: "deltaker_helse",
  description:
    "Sykepleier og hendelser for én deltakelse: helseinfo fra booking og sykepleier, sykepleierens notater, helsehendelser og hendelser meldt av ledere. Krever deltakelsens id.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "Deltakelsens id (deltaker_id)" } },
    required: ["id"],
  },
  run: async (db, args) => {
    const id = str(args.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Oppgi deltakelsens id.");
    const [info, notes, events, links, leaders] = await Promise.all([
      db.from("participant_health_info").select("info, updated_at").eq("participant_id", id),
      db.from("participant_health_notes").select("content, created_at, created_by").eq("participant_id", id).order("created_at"),
      db.from("participant_health_events").select("event_type, severity, description, created_at, created_by").eq("participant_id", id).order("created_at"),
      db.from("participant_incident_participants").select("incident_id").eq("participant_id", id),
      db.from("leaders").select("id, name"),
    ]);
    for (const r of [info, notes, events, links]) if (r.error) throw new Error(r.error.message);
    const ids = (links.data ?? []).map((l) => l.incident_id);
    const incidents = ids.length
      ? await db.from("participant_incidents").select("title, category, severity, description, created_at").in("id", ids).order("created_at")
      : { data: [], error: null };
    if (incidents.error) throw new Error(incidents.error.message);
    const who = new Map((leaders.data ?? []).map((l) => [l.id, l.name]));
    return {
      helseinfo: (info.data ?? []).map((r) => ({ tekst: r.info, oppdatert: r.updated_at })).filter((r) => r.tekst),
      notater: (notes.data ?? []).map((r) => ({ tekst: r.content, tidspunkt: r.created_at, av: who.get(r.created_by) ?? null })),
      helsehendelser: (events.data ?? []).map((r) => ({
        type: r.event_type,
        alvorlighet: r.severity,
        beskrivelse: r.description,
        tidspunkt: r.created_at,
        av: who.get(r.created_by) ?? null,
      })),
      hendelser: (incidents.data ?? []).map((r) => ({
        tittel: r.title,
        kategori: r.category,
        alvorlighet: r.severity,
        beskrivelse: r.description,
        tidspunkt: r.created_at,
      })),
    };
  },
});

const SERVICE_VERSION = "2.3.1";

// Helsesjekk: prøver alle verktøyene og melder hvilke som virker. Brukes av
// admin («Tilkoblinger») for å oppdage at en endring i appen har knekt noe.
tools.push({
  name: "helsesjekk",
  description: "Prøver alle verktøyene i denne tjenesten og melder hvilke som virker og hvilke som feiler. Bruk dette for å sjekke at koblingen er i orden.",
  inputSchema: { type: "object", properties: {} },
  run: async (db) => {
    const results = [];
    for (const tool of tools) {
      if (tool.name === "helsesjekk") continue;
      const started = Date.now();
      try {
        const args = tool.sample ? await tool.sample(db) : {};
        if (args === null) {
          results.push({ verktoy: tool.name, ok: true, merknad: "ingen data å teste med", ms: Date.now() - started });
          continue;
        }
        await tool.run(db, args);
        results.push({ verktoy: tool.name, ok: true, ms: Date.now() - started });
      } catch (err) {
        results.push({ verktoy: tool.name, ok: false, feil: (err as Error).message, ms: Date.now() - started });
      }
    }
    const feil = results.filter((r) => !r.ok).length;
    return { ok: feil === 0, tjeneste: SERVICE_NAME, versjon: SERVICE_VERSION, antall_verktoy: results.length, feil, verktoy: results, sjekket: new Date().toISOString() };
  },
});

const toolByName = new Map(tools.map((t) => [t.name, t]));

// ---------- Kjøring og logg ----------

async function runTool(db: Db, name: string, args: Args, via: string): Promise<unknown> {
  const tool = toolByName.get(name);
  if (!tool) throw new Error(`Ukjent verktøy: ${name}`);
  const started = Date.now();
  let ok = true;
  try {
    return await tool.run(db, args ?? {});
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    // Logging skal aldri stoppe et svar.
    db.from("hub_api_log")
      .insert({ tool: name, args: args ?? {}, via, ok, duration_ms: Date.now() - started })
      .then(() => undefined, () => undefined);
  }
}

// deno-lint-ignore no-explicit-any
async function handleRpc(db: Db, msg: any): Promise<unknown | null> {
  const id = msg?.id;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  switch (msg?.method) {
    case "initialize":
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: SERVICE_NAME, version: SERVICE_VERSION },
        instructions:
          "Lesetilgang til Oksnøen Leirs lederapp. Start med leir_status eller perioder. Alle verktøy gjelder aktiv periode hvis ikke periode oppgis. Ingenting kan endres herfra.",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema, annotations: { readOnlyHint: true } })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      if (!toolByName.has(name)) return fail(-32602, `Ukjent verktøy: ${name}`);
      try {
        const result = await runTool(db, name, (msg.params?.arguments ?? {}) as Args, "mcp");
        return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (err) {
        return reply({ content: [{ type: "text", text: (err as Error).message }], isError: true });
      }
    }
    default:
      // Varsler (uten id) skal ikke ha svar.
      if (id === undefined || id === null) return null;
      return fail(-32601, `Ukjent metode: ${msg?.method}`);
  }
}

// ---------- Inngang ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Bruk POST" }, 405);

  const secret = Deno.env.get("HUB_API_KEY") ?? "";
  if (secret.length < 24) return json({ error: "HUB_API_KEY er ikke satt opp" }, 503);

  const auth = req.headers.get("authorization") ?? "";
  const given = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (req.headers.get("x-hub-key") ?? "");
  if (!given || !safeEqual(given, secret)) return json({ error: "Ingen tilgang" }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Ugyldig JSON" } }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });

  // Enkelt API for admin-dashboardet: { tool, args }
  if (body && !Array.isArray(body) && typeof body.tool === "string" && body.jsonrpc === undefined) {
    if (body.tool === "__verktoy") {
      return json({ verktoy: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    }
    try {
      return json({ ok: true, data: await runTool(db, body.tool, (body.args ?? {}) as Args, "api") });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 400);
    }
  }

  // MCP
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleRpc(db, m)))).filter((r) => r !== null);
    return replies.length ? json(replies) : new Response(null, { status: 202, headers: corsHeaders });
  }
  const reply = await handleRpc(db, body);
  return reply === null ? new Response(null, { status: 202, headers: corsHeaders }) : json(reply);
});
