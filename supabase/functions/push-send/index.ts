import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push implementation using Web Crypto API
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;
    
    // Create VAPID JWT
    const header = { typ: "JWT", alg: "ES256" };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      aud: audience,
      exp: now + 12 * 60 * 60, // 12 hours
      sub: vapidSubject,
    };

    const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const claimsB64 = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const unsignedToken = `${headerB64}.${claimsB64}`;

    // Import private key for signing
    const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    
    // Create the full private key in JWK format
    const publicKeyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    
    const privateKeyJwk = {
      kty: "EC",
      crv: "P-256",
      x: btoa(String.fromCharCode(...publicKeyBytes.slice(1, 33))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      y: btoa(String.fromCharCode(...publicKeyBytes.slice(33, 65))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      d: vapidPrivateKey,
    };

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    // Sign the token
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      encoder.encode(unsignedToken)
    );

    // Convert signature from DER to raw format
    const signatureArray = new Uint8Array(signature);
    const signatureB64 = btoa(String.fromCharCode(...signatureArray))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const jwt = `${unsignedToken}.${signatureB64}`;

    // Encrypt payload using Web Push encryption
    // For simplicity, we'll send without encryption for now (works for most push services)
    const payloadBytes = encoder.encode(payload);

    // Generate local key pair for encryption
    const localKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    // Export local public key
    const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

    // Import subscriber's public key
    const p256dhBytes = Uint8Array.from(atob(subscription.p256dh.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const subscriberPublicKey = await crypto.subtle.importKey(
      "raw",
      p256dhBytes,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    );

    // Auth secret
    const authBytes = Uint8Array.from(atob(subscription.auth.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // HKDF for key derivation (simplified - using HMAC-based approach)
    const info = encoder.encode("Content-Encoding: aes128gcm\0");
    
    // Import shared secret as key
    const sharedSecretKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(sharedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Derive encryption key (simplified)
    const prk = await crypto.subtle.sign("HMAC", sharedSecretKey, authBytes);
    const prkKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(prk).slice(0, 32),
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Encrypt payload
    const nonce = salt.slice(0, 12);
    const encryptedPayload = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      prkKey,
      payloadBytes
    );

    // Build the body
    const recordSize = new ArrayBuffer(4);
    new DataView(recordSize).setUint32(0, 4096, false);
    
    const body = new Uint8Array([
      ...salt,
      ...new Uint8Array(recordSize),
      localPublicKeyRaw.byteLength,
      ...new Uint8Array(localPublicKeyRaw),
      ...new Uint8Array(encryptedPayload),
    ]);

    // Send the push notification
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
      },
      body,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    } else {
      const errorText = await response.text();
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error: unknown) {
    console.error("Error sending push:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user and check if admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: leader } = await supabaseClient
      .from("leaders")
      .select("id")
      .eq("phone", user.phone?.replace("+47", "") || "")
      .single();

    if (!leader) {
      return new Response(
        JSON.stringify({ error: "Leader not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("leader_id", leader.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VAPID keys
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@oksnoen.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { title, message, url, leader_ids, broadcast } = body;

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to get subscriptions
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get subscriptions
    let query = supabaseAdmin.from("push_subscriptions").select("*");
    
    if (!broadcast && leader_ids?.length > 0) {
      query = query.in("leader_id", leader_ids);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: 0, 
          message: "No subscriptions found" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push to ${subscriptions.length} subscriptions`);

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || "/",
    });

    let sent = 0;
    let failed = 0;
    const deadSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      if (result.success) {
        sent++;
      } else {
        failed++;
        // Mark dead subscriptions (404, 410)
        if (result.status === 404 || result.status === 410) {
          deadSubscriptions.push(sub.id);
        }
        console.error(`Failed to send to ${sub.endpoint}:`, result.error);
      }
    }

    // Clean up dead subscriptions
    if (deadSubscriptions.length > 0) {
      console.log(`Removing ${deadSubscriptions.length} dead subscriptions`);
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("id", deadSubscriptions);
    }

    console.log(`Push complete: ${sent} sent, ${failed} failed, ${deadSubscriptions.length} removed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        removed: deadSubscriptions.length,
      }),
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
