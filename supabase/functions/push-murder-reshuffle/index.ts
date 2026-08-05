// Sends the "Morder-leken har startet" broadcast with the custom kill sound.
// Admin only. Notifies every player in the active period's game.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  type PushSubscription,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";
import { getApnsConfig, sendApnsAlert } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Custom APNs sound bundled as a root resource in the iOS App target. */
const MURDER_SOUND = "morderen-drept.caf";

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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAuth.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: period } = await supabaseAdmin
      .from("periods").select("id").eq("is_active", true).maybeSingle();
    if (!period) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no active period" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: game } = await supabaseAdmin
      .from("murder_games").select("id, is_active").eq("period_id", period.id).maybeSingle();
    if (!game) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no game" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    if (!appServer && !apnsCfg) {
      return new Response(JSON.stringify({ error: "No push transport configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: players } = await supabaseAdmin
      .from("murder_players").select("leader_id").eq("game_id", game.id);
    const playerIds = (players ?? []).map((p) => p.leader_id);
    if (playerIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no players" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions").select("*").in("leader_id", playerIds);

    const title = "🔪 Morder-leken har startet";
    const message = "Åpne appen for å se hvem du jakter på. Lykke til.";
    const url = "/morder";
    const payloadData = JSON.stringify({ title, body: message, url });

    let sent = 0;
    let failed = 0;
    for (const sub of (subscriptions ?? []) as Array<Record<string, string>>) {
      if (sub.channel === "apns") {
        if (!apnsCfg) continue;
        const res = await sendApnsAlert(apnsCfg, sub.native_token, {
          title, body: message, url, sound: MURDER_SOUND,
        });
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
          await subscriber.pushTextMessage(payloadData, { urgency: Urgency.High, ttl: 3600 });
          sent++;
        } catch (e) {
          failed++;
          console.error(`web push failed for ${sub.id}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }

    console.log(`Murder start broadcast: sent=${sent} failed=${failed} players=${playerIds.length}`);
    return new Response(JSON.stringify({ success: true, sent, failed, players: playerIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("push-murder-reshuffle error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
