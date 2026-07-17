import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  type PushSubscription,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";
import { isApnsConfigured, sendApplePush } from "../_shared/apns.ts";

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
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { title, message, url, alert_type, sender_name } = body;

    console.log("Admin alert request received:", { title, alert_type, sender_name });

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin leader IDs
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("leader_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch admins" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminLeaderIds = adminRoles?.map(r => r.leader_id) || [];
    console.log(`Found ${adminLeaderIds.length} admins`);

    if (adminLeaderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No admins found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Restrict to active admin leaders only
    const { data: activeAdmins } = await supabaseAdmin
      .from("leaders")
      .select("id")
      .in("id", adminLeaderIds)
      .eq("is_active", true);
    const activeAdminIds = (activeAdmins ?? []).map(l => l.id);
    console.log(`Active admins: ${activeAdminIds.length}/${adminLeaderIds.length}`);

    if (activeAdminIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active admins" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions for all active admins
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("leader_id", activeAdminIds);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No admin push subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No admin push subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} admin subscriptions`);

    let appServer: ApplicationServer | null = null;
    const getAppServer = async (): Promise<ApplicationServer> => {
      if (appServer) return appServer;

      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@oksnoen.com";

      if (!vapidPublicKey || !vapidPrivateKey) {
        throw new Error("VAPID keys not configured");
      }

      const vapidKeys = await importVapidKeysToCryptoKeyPair(vapidPublicKey, vapidPrivateKey);
      appServer = await ApplicationServer.new({
        contactInformation: vapidSubject,
        vapidKeys: vapidKeys,
      });
      return appServer;
    };

    const payloadData = JSON.stringify({ 
      title, 
      body: message, 
      url: url || "/admin-settings" 
    });

    let sent = 0;
    let failed = 0;
    let nativeSkipped = 0;
    const deadSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        if (sub.channel === "apns" || sub.endpoint?.startsWith("native://")) {
          const token = sub.native_token || sub.endpoint.replace("native://", "");
          if (!isApnsConfigured()) {
            nativeSkipped++;
            console.error(`Skipping native subscription ${sub.id}: APNs is not configured`);
            continue;
          }
          await sendApplePush(token, title, message, url || "/admin-settings");
          sent++;
          console.log(`Successfully sent APNs push to admin ${sub.leader_id}`);
          continue;
        }

        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        const subscriber = await (await getAppServer()).subscribe(pushSubscription);
        await subscriber.pushTextMessage(payloadData, { urgency: Urgency.High, ttl: 3600 });

        sent++;
        console.log(`Successfully sent to admin ${sub.leader_id}`);
      } catch (error: unknown) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error sending to ${sub.id}:`, errorMessage);
        
        if (errorMessage.toLowerCase().includes("gone") || errorMessage.includes("410") || errorMessage.includes("404")) {
          deadSubscriptions.push(sub.id);
        }
      }
    }

    // Cleanup dead subscriptions
    if (deadSubscriptions.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadSubscriptions);
      console.log(`Cleaned up ${deadSubscriptions.length} dead subscriptions`);
    }

    console.log(`Admin alert complete: ${sent} sent, ${failed} failed`);

    return new Response(
        JSON.stringify({ success: true, sent, failed, removed: deadSubscriptions.length, nativeSkipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in push-admin-alert:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
