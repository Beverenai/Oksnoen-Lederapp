import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  type PushSubscription,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, message, url, leader_ids, broadcast, sender_leader_id } = body;

    console.log("Push send request received:", { title, broadcast, sender_leader_id });

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (!sender_leader_id) {
      return new Response(
        JSON.stringify({ error: "Sender leader ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("leader_id", sender_leader_id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@oksnoen.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert keys to JWK format
    const publicKeyBytes = base64urlToUint8Array(vapidPublicKey);
    const x = publicKeyBytes.slice(1, 33);
    const y = publicKeyBytes.slice(33, 65);
    
    const jwkKeys = {
      publicKey: { kty: "EC", crv: "P-256", x: uint8ArrayToBase64url(x), y: uint8ArrayToBase64url(y) },
      privateKey: { kty: "EC", crv: "P-256", x: uint8ArrayToBase64url(x), y: uint8ArrayToBase64url(y), d: vapidPrivateKey }
    };

    const appServer = await ApplicationServer.new({ contactInformation: vapidSubject, vapidKeys: jwkKeys });

    let query = supabaseAdmin.from("push_subscriptions").select("*");
    if (!broadcast && leader_ids?.length > 0) {
      query = query.in("leader_id", leader_ids);
    }

    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push to ${subscriptions.length} subscriptions`);

    const payloadData = JSON.stringify({ title, body: message, url: url || "/" });

    let sent = 0;
    let failed = 0;
    const deadSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        const subscriber = await appServer.subscribe(pushSubscription);
        await subscriber.pushTextMessage(payloadData, { urgency: Urgency.Normal, ttl: 3600 });

        sent++;
        console.log(`Successfully sent to ${sub.id}`);
      } catch (error: unknown) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error sending to ${sub.id}:`, errorMessage);
        
        if (errorMessage.toLowerCase().includes("gone") || errorMessage.includes("410") || errorMessage.includes("404")) {
          deadSubscriptions.push(sub.id);
        }
      }
    }

    if (deadSubscriptions.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadSubscriptions);
    }

    console.log(`Push complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, removed: deadSubscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in push-send:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
