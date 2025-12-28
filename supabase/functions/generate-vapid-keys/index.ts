import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VAPID key generation using Web Crypto API
async function generateVAPIDKeys() {
  // Generate ECDSA P-256 key pair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable
    ["sign", "verify"]
  );

  // Export public key in raw format
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Export private key in JWK format to get the 'd' parameter
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const privateKeyBase64 = privateKeyJwk.d!;

  return {
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
  };
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

    // Check admin role using phone number matching
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

    // Generate VAPID keys
    console.log("Generating VAPID keys...");
    const keys = await generateVAPIDKeys();

    console.log("VAPID keys generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        instructions: [
          "1. Kopier PUBLIC_KEY og legg til som VAPID_PUBLIC_KEY secret",
          "2. Kopier PRIVATE_KEY og legg til som VAPID_PRIVATE_KEY secret",
          "3. Legg til VAPID_SUBJECT secret med verdi 'mailto:support@oksnoen.com'",
          "4. VIKTIG: Lagre disse trygt - du kan ikke generere de samme nøklene igjen!",
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating VAPID keys:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to generate VAPID keys", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
