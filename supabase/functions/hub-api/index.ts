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
//   - Helse, sykepleiernotater, hendelser, fritekstnotater og kontaktinfo
//     er aldri med i svarene.
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
});

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
          .select("id, person_id, name, birth_date, room, has_arrived, times_attended, insj_points, image_thumb_url, cabins(name), participant_teams(name)")
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
          bilde: r.image_thumb_url ?? null,
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
    description: "Alt om én deltaker i en periode: hytte, rom, lag, armbånd, og alle aktiviteter med tidspunkt og hvem som registrerte. Oppgi id eller navn.",
    inputSchema: {
      type: "object",
      properties: { ...periodeProp, id: { type: "string" }, navn: { type: "string" } },
    },
    run: async (db, args) => {
      const id = str(args.id);
      const navn = str(args.navn).replace(/[%,()]/g, "");
      if (!id && !navn) throw new Error("Oppgi id eller navn.");
      const cols = "id, person_id, name, birth_date, room, has_arrived, times_attended, insj_points, period_id, image_thumb_url, cabins(name), participant_teams(name)";
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
          .select("id, room, image_thumb_url, cabins(name), periods(name, season_year)")
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
        bilde: r.image_thumb_url ?? null,
        andre_deltakelser: andre.map((d) => ({
          id: d.id,
          periode: d.periods?.name ?? null,
          aar: d.periods?.season_year ?? null,
          hytte: d.cabins?.name ?? null,
          rom: d.room ?? null,
          bilde: d.image_thumb_url ?? null,
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
      const cols = "id, person_id, name, birth_date, room, times_attended, image_thumb_url, period_id, cabins(name), periods(name, season_year, start_date)";
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
            bilde: r.image_thumb_url ?? null,
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
const SERVICE_VERSION = "1.3.0";

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
