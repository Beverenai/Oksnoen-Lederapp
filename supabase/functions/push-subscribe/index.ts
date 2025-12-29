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
    const { endpoint, keys, leader_id } = body;

    // Validate required fields
    if (!leader_id) {
      console.error("Missing leader_id in request");
      return new Response(
        JSON.stringify({ error: "Leader ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      console.error("Invalid subscription data:", { endpoint: !!endpoint, keys: !!keys });
      return new Response(
        JSON.stringify({ error: "Invalid subscription data" }),
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
          p256dh: keys.p256dh,
          auth: keys.auth,
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
