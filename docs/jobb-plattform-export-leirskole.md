# Kobling: hent leirskole-uker fra jobb-plattformen (oksnoen-leder-flow)

LederApp har en edge-funksjon `sync-leirskole-jobb` som kaller:

    POST https://<jobb-plattform>/functions/v1/export-leirskole
    header: x-sync-secret: <LEIRSKOLE_SYNC_SECRET>

Jobb-plattformen må derfor få en ny edge-funksjon `export-leirskole` med
den SAMME hemmelige nøkkelen lagret som `LEIRSKOLE_SYNC_SECRET`.

Forventet svar:

```json
{
  "weeks": [
    {
      "external_ref": "<uuid fra leirskole_weeks>",
      "name": "Uke 34",
      "start_date": "2026-08-17",
      "end_date": "2026-08-21",
      "notes": null,
      "staff": [
        { "external_ref": "<profil-uuid>", "name": "Fornavn Etternavn", "role_label": "Leder" }
      ]
    }
  ]
}
```

## Kode å legge inn i jobb-plattformen (supabase/functions/export-leirskole/index.ts)

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("LEIRSKOLE_SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: weeks } = await admin
    .from("leirskole_weeks")
    .select("id, name, start_date, end_date, description")
    .order("start_date");

  const weekIds = (weeks ?? []).map((w) => w.id);

  // Hvem som er satt opp / godkjent for hver uke
  const { data: avail } = await admin
    .from("leirskole_week_availability")
    .select("week_id, user_id, is_available")
    .in("week_id", weekIds);

  const userIds = [...new Set((avail ?? []).map((a) => a.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]),
  );

  const payload = {
    weeks: (weeks ?? []).map((w) => ({
      external_ref: w.id,
      name: w.name,
      start_date: w.start_date,
      end_date: w.end_date,
      notes: w.description ?? null,
      staff: (avail ?? [])
        .filter((a) => a.week_id === w.id && a.is_available)
        .map((a) => ({ external_ref: a.user_id, name: nameById.get(a.user_id) ?? null })),
    })),
  };

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```
