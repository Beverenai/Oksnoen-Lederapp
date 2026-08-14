// Sender varsling når en leder gir slurker til en annen leder.
// Avsender og mottaker leses fra raden server-side, og notified_at fungerer
// som send-lås slik at samme slurk ikke kan varsles flere ganger.
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
    const sipId = typeof body?.sip_id === "string" ? body.sip_id : null;
    if (!sipId) return json({ error: "sip_id is required" }, 400);

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

    const { data: sip } = await supabaseAdmin
      .from("leader_sips")
      .select("id, from_leader_id, to_leader_id, amount, message, drink_type, notified_at")
      .eq("id", sipId)
      .maybeSingle();
    if (!sip) return json({ error: "Not found" }, 404);
    if (sip.from_leader_id !== caller.id) return json({ error: "Forbidden" }, 403);
    if (sip.notified_at) return json({ success: true, sent: 0, reason: "already sent" });

    // Send-lås: bare den første oppdateringen får sende.
    const { data: locked } = await supabaseAdmin
      .from("leader_sips")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", sip.id)
      .is("notified_at", null)
      .select("id")
      .maybeSingle();
    if (!locked) return json({ success: true, sent: 0, reason: "already sent" });

    const recipientId = sip.to_leader_id;
    const { data: recipient } = await supabaseAdmin
      .from("leaders")
      .select("id, is_external")
      .eq("id", recipientId)
      .maybeSingle();
    if (!recipient || recipient.is_external) {
      return json({ success: true, sent: 0, reason: "no recipient account" });
    }

    const amount = Number(sip.amount) || 1;
    const drinkType = sip.drink_type === "wine" || sip.drink_type === "drink" ? sip.drink_type : "beer";
    const drinkMeta = {
      beer: { emoji: "🍺", label: "øl", sound: "sip-beer.caf" },
      wine: { emoji: "🍷", label: "vin", sound: "sip-wine.caf" },
      drink: { emoji: "🍸", label: "drink", sound: "sip-drink.caf" },
    }[drinkType];
    const title = `${drinkMeta.emoji} Du har fått slurker`;
    const message = `${caller.name} ga deg ${amount} ${amount === 1 ? "slurk" : "slurker"} ${drinkMeta.label}${
      sip.message ? ` — «${sip.message}»` : ""
    }`;
    const url = "/slurker";

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

    const payloadData = JSON.stringify({ title, body: message, url, badge, drink: drinkType });
    let sent = 0;
    let failed = 0;

    for (const sub of (subscriptions ?? []) as Array<Record<string, string>>) {
      if (sub.channel === "apns") {
        if (!apnsCfg) continue;
        const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: message, url, badge, sound: drinkMeta.sound });
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

    console.log(`push-sips ${sip.id}: sent=${sent} failed=${failed}`);
    return json({ success: true, sent, failed });
  } catch (error) {
    console.error("push-sips error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
