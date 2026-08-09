// Sends the Klineliste connection notifications.
//
// The caller only supplies a hookup id and the kind of event. Sender and
// recipient are derived from the row server-side, and a UNIQUE row in
// hookup_notifications per (hookup, kind) acts as the send lock, so nobody can
// spoof a notification or spam the same one twice.
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
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateKeyBase64 },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  return { publicKey, privateKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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

    const body = await req.json().catch(() => ({}));
    const hookupId = typeof body?.hookup_id === "string" ? body.hookup_id : null;
    const kind = body?.kind === "confirmed" ? "confirmed" : body?.kind === "requested" ? "requested" : null;
    if (!hookupId || !kind) return json({ error: "hookup_id and kind are required" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: caller } = await supabaseAdmin
      .from("leaders")
      .select("id, name")
      .eq("auth_user_id", claimsData.claims.sub)
      .maybeSingle();
    if (!caller) return json({ error: "Forbidden" }, 403);

    const { data: hookup } = await supabaseAdmin
      .from("leader_hookups")
      .select("id, leader_a_id, leader_b_id, requested_by, status")
      .eq("id", hookupId)
      .maybeSingle();
    if (!hookup) return json({ error: "Not found" }, 404);

    const involves = hookup.leader_a_id === caller.id || hookup.leader_b_id === caller.id;
    if (!involves) return json({ error: "Forbidden" }, 403);

    // Who should hear about this?
    //  - requested: the counterpart of the requester
    //  - confirmed: the original requester
    const recipientId = kind === "requested"
      ? (hookup.leader_a_id === hookup.requested_by ? hookup.leader_b_id : hookup.leader_a_id)
      : hookup.requested_by;
    if (recipientId === caller.id) return json({ success: true, sent: 0, reason: "self" });

    const { data: recipient } = await supabaseAdmin
      .from("leaders")
      .select("id, is_external")
      .eq("id", recipientId)
      .maybeSingle();
    if (!recipient || recipient.is_external) {
      return json({ success: true, sent: 0, reason: "no recipient account" });
    }

    // Send lock — unique(hookup_id, kind).
    const { error: lockError } = await supabaseAdmin
      .from("hookup_notifications")
      .insert({ hookup_id: hookup.id, kind });
    if (lockError) return json({ success: true, sent: 0, reason: "already sent" });

    const title = kind === "requested" ? "💋 Ny kobling i klinelista" : "💋 Kobling bekreftet";
    const message = kind === "requested"
      ? `${caller.name} vil legge deg inn i klinelista`
      : `${caller.name} bekreftet koblingen`;
    const url = "/klineliste";

    const { data: badgeData } = await supabaseAdmin.rpc("get_my_unread_badge", {
      _leader_id: recipientId,
    });
    const badge = Number(badgeData) || 0;

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
      .eq("leader_id", recipientId);

    const payloadData = JSON.stringify({ title, body: message, url, badge });
    let sent = 0;
    let failed = 0;

    for (const sub of (subscriptions ?? []) as Array<Record<string, string>>) {
      if (sub.channel === "apns") {
        if (!apnsCfg) continue;
        const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: message, url, badge });
        if (res.ok) sent++;
        else {
          failed++;
          if (res.unregistered) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      } else {
        if (!appServer) continue;
        try {
          const pushSubscription: PushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          const subscriber = await appServer.subscribe(pushSubscription);
          await subscriber.pushTextMessage(payloadData, { urgency: Urgency.Normal, ttl: 3600 });
          sent++;
        } catch (e) {
          failed++;
          console.error(`web push failed for ${sub.id}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }

    console.log(`push-hookup ${kind} for ${hookup.id}: sent=${sent} failed=${failed}`);
    return json({ success: true, sent, failed });
  } catch (error) {
    console.error("push-hookup error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});