// Sender oppdatert innhold til live-visningen «Denne økta» på lederes iPhone,
// også når appen er lukket. Kalles av databasen (notify_live_activity) når
// oppdraget til en leder eller aktiv økt endres. Krever den delte hemmeligheten.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getApnsConfig, sendApnsLiveActivity } from "../_shared/apns.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST" }, 405);
  const secret = Deno.env.get("LIVE_ACTIVITY_SECRET");
  if (!secret || req.headers.get("x-live-secret") !== secret) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.leader_ids)
    ? body.leader_ids.filter((x: unknown) => typeof x === "string").slice(0, 500)
    : [];
  if (!ids.length) return json({ sent: 0 });

  const cfg = getApnsConfig();
  if (!cfg) return json({ error: "APNs mangler" }, 500);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [{ data: tokens }, { data: contents }, { data: period }] = await Promise.all([
    db.from("live_activity_tokens").select("leader_id, token").in("leader_id", ids),
    db.from("leader_content").select("leader_id, current_activity, extra_activity, obs_message").in("leader_id", ids),
    db.from("periods").select("id").eq("is_active", true).maybeSingle(),
  ]);
  if (!tokens?.length) return json({ sent: 0 });

  // Aktiv økt og felles påminnelse, samme kilde som forsiden i appen.
  const keys = period?.id ? [`session_activities_data:${period.id}`, "session_activities_data"] : ["session_activities_data"];
  const { data: cfgRows } = await db.from("app_config").select("key, value").in("key", keys);
  const raw = cfgRows?.find((r) => r.key === keys[0])?.value ?? cfgRows?.find((r) => r.key === keys[keys.length - 1])?.value;
  let sessionLabel = "";
  let reminder = "";
  try {
    const parsed = raw ? JSON.parse(String(raw)) : null;
    if (parsed?.active) {
      sessionLabel = `${parsed.active}. økt`;
      reminder = String(parsed.sessions?.[String(parsed.active)]?.reminder ?? "").trim();
    }
  } catch {
    // ugyldig oppsett: send uten økt
  }

  const byLeader = new Map((contents ?? []).map((c) => [c.leader_id, c]));
  let sent = 0;
  const dead: string[] = [];
  for (const t of tokens) {
    const c = byLeader.get(t.leader_id);
    const activity = String(c?.current_activity ?? "").trim();
    const state = activity
      ? {
        activity,
        sessionLabel,
        extra: String(c?.extra_activity ?? "").trim(),
        obs: String(c?.obs_message ?? "").trim() || reminder,
      }
      : null; // tomt oppdrag: avslutt visningen
    const res = await sendApnsLiveActivity(cfg, t.token, state);
    if (res.ok) sent++;
    else if (res.unregistered) dead.push(t.leader_id);
  }
  if (dead.length) await db.from("live_activity_tokens").delete().in("leader_id", dead);
  return json({ sent, removed: dead.length });
});
