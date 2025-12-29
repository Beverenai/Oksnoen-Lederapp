import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Support both nested keys and flat keys for iOS/Safari compatibility
    const { endpoint, keys, p256dh: directP256dh, auth: directAuth, leader_id } = body;

    // Extract keys - prefer direct keys, fall back to nested
    const p256dh = directP256dh || keys?.p256dh;
    const auth = directAuth || keys?.auth;

    console.log("push-subscribe request received:", {
      hasEndpoint: !!endpoint,
      hasLeaderId: !!leader_id,
      hasDirectP256dh: !!directP256dh,
      hasDirectAuth: !!directAuth,
      hasNestedKeys: !!keys,
      hasNestedP256dh: !!keys?.p256dh,
      hasNestedAuth: !!keys?.auth,
    });

    // Validate required fields
    if (!leader_id) {
      console.error("Missing leader_id in request");
      return new Response(
        JSON.stringify({ error: "Leader ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!endpoint) {
      console.error("Missing endpoint in request");
      return new Response(
        JSON.stringify({ error: "Endpoint is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!p256dh || !auth) {
      console.error("Missing subscription keys:", { p256dh: !!p256dh, auth: !!auth });
      return new Response(
        JSON.stringify({ error: "Subscription keys (p256dh, auth) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to verify leader exists and insert subscription
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify that the leader exists
    const { data: leader, error: leaderError } = await supabaseAdmin
      .from("leaders")
      .select("id")
      .eq("id", leader_id)
      .single();

    if (leaderError || !leader) {
      console.error("Leader not found:", leader_id);
      return new Response(
        JSON.stringify({ error: "Leader not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Saving push subscription for leader ${leader.id}`);

    // Upsert subscription (update if endpoint exists, insert if not)
    const { error: insertError } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          leader_id: leader.id,
          endpoint,
          p256dh,
          auth,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (insertError) {
      console.error("Error saving subscription:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Push subscription saved successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in push-subscribe:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
