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

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importVapidKeysToCryptoKeyPair(
  publicKeyBase64: string,
  privateKeyBase64: string
): Promise<CryptoKeyPair> {
  const publicKeyBytes = base64urlToUint8Array(publicKeyBase64);
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  const publicJwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64url(x),
    y: uint8ArrayToBase64url(y),
  };

  const privateJwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64url(x),
    y: uint8ArrayToBase64url(y),
    d: privateKeyBase64,
  };

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { publicKey, privateKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const participantName = typeof body?.participant_name === 'string' ? body.participant_name.slice(0, 120) : '';
    const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : '';
    const targetLeaderId = typeof body?.target_leader_id === 'string' ? body.target_leader_id : null;

    if (!message) {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let leaderIds: string[] = [];
    if (targetLeaderId) {
      const { data } = await supabaseAdmin.from("leaders").select("id").eq("id", targetLeaderId).eq("is_active", true);
      leaderIds = (data ?? []).map((l) => l.id);
    } else {
      const { data } = await supabaseAdmin.from("leaders").select("id").eq("is_active", true).eq("is_external", false);
      leaderIds = (data ?? []).map((l) => l.id);
    }

    if (leaderIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No active recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("leader_id", leaderIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const title = participantName ? `Oppdrag: ${participantName}` : "Nytt oppdrag";
    const url = "/";

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@oksnoen.com";
    const apnsCfg = getApnsConfig();

    let appServer: Awaited<ReturnType<typeof ApplicationServer.new>> | null = null;
    if (vapidPublicKey && vapidPrivateKey) {
      const vapidKeys = await importVapidKeysToCryptoKeyPair(vapidPublicKey, vapidPrivateKey);
      appServer = await ApplicationServer.new({ contactInformation: vapidSubject, vapidKeys });
    }
    if (!appServer && !apnsCfg) {
      return new Response(JSON.stringify({ error: "No push transport configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payloadData = JSON.stringify({ title, body: message, url });
    let sent = 0;
    let failed = 0;
    const deadSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      if (sub.channel === "apns") {
        if (!apnsCfg) continue;
        const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: message, url });
        if (res.ok) sent++;
        else {
          failed++;
          if (res.unregistered) deadSubscriptions.push(sub.id);
        }
        continue;
      }
      if (!appServer) continue;
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        const subscriber = await appServer.subscribe(pushSubscription);
        await subscriber.pushTextMessage(payloadData, { urgency: Urgency.High, ttl: 3600 });
        sent++;
      } catch (error: unknown) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Push failed ${sub.id}: ${errorMessage}`);
        if (errorMessage.toLowerCase().includes("gone") || errorMessage.includes("410") || errorMessage.includes("404")) {
          deadSubscriptions.push(sub.id);
        }
      }
    }

    if (deadSubscriptions.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadSubscriptions);
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error in push-participant-task:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
