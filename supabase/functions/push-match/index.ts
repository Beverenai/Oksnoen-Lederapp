// Varsler motparten om ny match på Øksnøen Tinder, og om nye meldinger i match-chatten.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApplicationServer, type PushSubscription, Urgency } from "jsr:@negrel/webpush@0.5.0";
import { getApnsConfig, sendApnsAlert } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importVapidKeys(publicKeyBase64: string, privateKeyBase64: string): Promise<CryptoKeyPair> {
  const publicKeyBytes = base64urlToUint8Array(publicKeyBase64);
  const x = uint8ArrayToBase64url(publicKeyBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(publicKeyBytes.slice(33, 65));
  const publicKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y }, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  const privateKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y, d: privateKeyBase64 }, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  return { publicKey, privateKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const uid = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind === "message" ? "message" : "match";
    const targetInput = typeof body?.target_leader_id === "string" ? body.target_leader_id : null;
    const matchId = typeof body?.match_id === "string" ? body.match_id : null;
    const preview = typeof body?.preview === "string" ? body.preview.slice(0, 120) : "";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: caller } = await supabaseAdmin
      .from("leaders")
      .select("id, name")
      .eq("auth_user_id", uid)
      .maybeSingle();
    if (!caller) return json({ error: "Forbidden" }, 403);

    // Finn motparten, og bekreft at det finnes en match mellom dem.
    let targetId: string | null = null;
    if (matchId) {
      const { data: match } = await supabaseAdmin
        .from("leader_matches")
        .select("leader_a_id, leader_b_id")
        .eq("id", matchId)
        .maybeSingle();
      if (!match) return json({ error: "Not found" }, 404);
      if (match.leader_a_id !== caller.id && match.leader_b_id !== caller.id) {
        return json({ error: "Forbidden" }, 403);
      }
      targetId = match.leader_a_id === caller.id ? match.leader_b_id : match.leader_a_id;
    } else if (targetInput) {
      const a = caller.id < targetInput ? caller.id : targetInput;
      const b = caller.id < targetInput ? targetInput : caller.id;
      const { data: match } = await supabaseAdmin
        .from("leader_matches")
        .select("id")
        .eq("leader_a_id", a)
        .eq("leader_b_id", b)
        .maybeSingle();
      if (!match) return json({ error: "No match" }, 404);
      targetId = targetInput;
    }
    if (!targetId) return json({ error: "target_leader_id or match_id is required" }, 400);

    const firstName = String(caller.name ?? "En leder").split(" ")[0];
    const title = kind === "message" ? `💬 Melding fra ${firstName}` : "❤️ Det er match!";
    const text =
      kind === "message"
        ? preview || "Ny melding i match-chatten"
        : `Du og ${firstName} sveipet ja på hverandre. Si hei!`;
    const url = "/kline-tinder";

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@oksnoen.com";
    const apnsCfg = getApnsConfig();
    let appServer: Awaited<ReturnType<typeof ApplicationServer.new>> | null = null;
    if (vapidPublicKey && vapidPrivateKey) {
      appServer = await ApplicationServer.new({
        contactInformation: vapidSubject,
        vapidKeys: await importVapidKeys(vapidPublicKey, vapidPrivateKey),
      });
    }
    if (!appServer && !apnsCfg) return json({ error: "No push transport configured" }, 503);

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("leader_id", targetId);

    let sent = 0;
    let failed = 0;

    for (const sub of (subscriptions ?? []) as Array<Record<string, string>>) {
      const { data: badgeData } = await supabaseAdmin.rpc("get_my_unread_badge", { _leader_id: sub.leader_id });
      const badge = Number(badgeData) || 0;

      if (sub.channel === "apns") {
        if (!apnsCfg) continue;
        const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: text, url, badge });
        if (res.ok) sent++;
        else {
          failed++;
          if (res.unregistered) await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      } else {
        if (!appServer) continue;
        try {
          const pushSubscription: PushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          const subscriber = await appServer.subscribe(pushSubscription);
          await subscriber.pushTextMessage(JSON.stringify({ title, body: text, url, badge }), {
            urgency: Urgency.Normal,
            ttl: 3600,
          });
          sent++;
        } catch (e) {
          failed++;
          console.error(`web push failed for ${sub.id}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }

    console.log(`push-match ${kind} -> ${targetId}: sent=${sent} failed=${failed}`);
    return json({ success: true, sent, failed });
  } catch (error) {
    console.error("push-match error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
