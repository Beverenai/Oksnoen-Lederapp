import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const JOBB_EXPORT_URL = "https://hiifcjletsoklagflnvn.supabase.co/functions/v1/export-leirskole";

type ExportStaff = { external_ref?: string | null; name?: string | null; role_label?: string | null };
type ExportWeek = {
  external_ref: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  staff?: ExportStaff[] | null;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Ikke innlogget" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Ikke innlogget" }, 401);
    const { data: isAdmin } = await userClient.rpc("is_admin");
    if (!isAdmin) return json({ error: "Kun admin" }, 403);

    const secret = Deno.env.get("LEIRSKOLE_SYNC_SECRET");
    if (!secret) return json({ error: "Mangler LEIRSKOLE_SYNC_SECRET" }, 500);

    const res = await fetch(JOBB_EXPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": secret },
      body: JSON.stringify({ source: "lederapp" }),
    });
    const text = await res.text();
    if (!res.ok) {
      return json({ error: `Jobb-plattformen svarte ${res.status}`, detail: text.slice(0, 400) }, 502);
    }

    let payload: { weeks?: ExportWeek[] };
    try {
      payload = JSON.parse(text);
    } catch {
      return json({ error: "Ugyldig svar fra jobb-plattformen" }, 502);
    }
    const weeks = Array.isArray(payload.weeks) ? payload.weeks : [];
    if (!weeks.length) return json({ imported: 0, staff: 0, unmatched: [], message: "Ingen uker å hente" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: leaders } = await admin.from("leaders").select("id, name").is("deleted_at", null);
    const byName = new Map<string, string>();
    for (const l of leaders ?? []) if (l.name) byName.set(norm(l.name), l.id);

    let importedWeeks = 0;
    let staffLinked = 0;
    const unmatched: string[] = [];

    for (const w of weeks) {
      if (!w?.external_ref || !w?.name || !w?.start_date || !w?.end_date) continue;

      const { data: weekRow, error: weekErr } = await admin
        .from("leirskole_weeks")
        .upsert(
          {
            external_ref: w.external_ref,
            name: w.name,
            start_date: w.start_date,
            end_date: w.end_date,
            notes: w.notes ?? null,
          },
          { onConflict: "external_ref" },
        )
        .select("id")
        .single();
      if (weekErr || !weekRow) continue;
      importedWeeks++;

      for (const s of w.staff ?? []) {
        const name = (s?.name ?? "").trim();
        if (!name) continue;
        const leaderId = byName.get(norm(name));
        if (!leaderId) {
          if (!unmatched.includes(name)) unmatched.push(name);
          continue;
        }
        const { data: existing } = await admin
          .from("leirskole_staff")
          .select("id")
          .eq("week_id", weekRow.id)
          .eq("leader_id", leaderId)
          .maybeSingle();
        if (existing) continue;
        const { error: staffErr } = await admin.from("leirskole_staff").insert({
          week_id: weekRow.id,
          leader_id: leaderId,
          role_label: s.role_label ?? null,
          external_ref: s.external_ref ?? null,
        });
        if (!staffErr) staffLinked++;
      }
    }

    return json({ imported: importedWeeks, staff: staffLinked, unmatched });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ukjent feil" }, 500);
  }
});
