// Sends the "a player was killed" broadcast for Morder-leken.
//
// Fully server-authorized and idempotent: the caller supplies NO victim,
// killer or player ids. We derive everything from the database (confirmed
// kill claims in the active period's game) and use a UNIQUE row in
// murder_death_notifications per claim as the send lock, so retries and
// simultaneous victim/admin confirmations can never duplicate a push.
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Caller must be a known leader (any role). No client-supplied ids are used.
    const { data: callerLeader } = await supabaseAdmin
      .from("leaders")
      .select("id")
      .eq("auth_user_id", claimsData.claims.sub)
      .maybeSingle();
    if (!callerLeader) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Active period -> active game
    const { data: period } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    if (!period) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: "no active period" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: game } = await supabaseAdmin
      .from("murder_games")
      .select("id")
      .eq("period_id", period.id)
      .maybeSingle();
    if (!game) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: "no game" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All confirmed kills in this game, and the ones already announced.
    const { data: confirmed } = await supabaseAdmin
      .from("murder_kill_claims")
      .select("id, victim_leader_id, confirmed_at")
      .eq("game_id", game.id)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: true });

    const { data: alreadySent } = await supabaseAdmin
      .from("murder_death_notifications")
      .select("claim_id")
      .eq("game_id", game.id);
    const sentClaimIds = new Set((alreadySent ?? []).map((r) => r.claim_id));

    const pending = (confirmed ?? []).filter((c) => !sentClaimIds.has(c.id));
    if (pending.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Push transports
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

    // Everyone in the round (dead players stay informed).
    const { data: players } = await supabaseAdmin
      .from("murder_players")
      .select("leader_id")
      .eq("game_id", game.id);
    const playerIds = (players ?? []).map((p) => p.leader_id);

    const { data: subscriptions } = playerIds.length
      ? await supabaseAdmin.from("push_subscriptions").select("*").in("leader_id", playerIds)
      : { data: [] as Array<Record<string, unknown>> };

    let announced = 0;
    let sentTotal = 0;
    let failedTotal = 0;

    for (const claim of pending) {
      // Idempotency lock: unique(claim_id). Whoever inserts first sends.
      const { error: lockError } = await supabaseAdmin
        .from("murder_death_notifications")
        .insert({ game_id: game.id, claim_id: claim.id, victim_leader_id: claim.victim_leader_id });
      if (lockError) {
        console.log(`Claim ${claim.id} already announced (or lock failed): ${lockError.message}`);
        continue;
      }

      const title = "☠️ En spiller er drept";
      // Never reveal the victim, the killer or any secret targets.
      const message = "En spiller har blitt drept i Morder-leken.";
      const url = "/morder";
      const payloadData = JSON.stringify({ title, body: message, url });

      let sent = 0;
      let failed = 0;
      for (const sub of (subscriptions ?? []) as Array<Record<string, string>>) {
        if (sub.channel === "apns") {
          if (!apnsCfg) continue;
          const res = await sendApnsAlert(apnsCfg, sub.native_token, {
            title,
            body: message,
            url,
            sound: MURDER_SOUND,
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
            await subscriber.pushTextMessage(payloadData, { urgency: Urgency.Normal, ttl: 3600 });
            sent++;
          } catch (e) {
            failed++;
            console.error(`web push failed for ${sub.id}:`, e instanceof Error ? e.message : String(e));
          }
        }
      }

      await supabaseAdmin
        .from("murder_death_notifications")
        .update({ sent_count: sent })
        .eq("claim_id", claim.id);

      announced++;
      sentTotal += sent;
      failedTotal += failed;
      console.log(`Announced death for claim ${claim.id}: sent=${sent} failed=${failed}`);
    }

    return new Response(JSON.stringify({ success: true, notified: announced, sent: sentTotal, failed: failedTotal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("push-murder-death error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
