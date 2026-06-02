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
    const {
      endpoint,
      keys,
      p256dh: directP256dh,
      auth: directAuth,
      leader_id,
      is_native,
      native_token,
      platform: platformInput,
      channel: channelInput,
    } = body;

    // Extract keys - prefer direct keys, fall back to nested
    const p256dh = directP256dh || keys?.p256dh;
    const auth = directAuth || keys?.auth;

    // Determine channel: explicit > native token > default web
    const isNative = !!(is_native || native_token || channelInput === "apns");
    const channel = isNative ? "apns" : "web";
    const platform = isNative ? (platformInput || "ios") : null;

    console.log("push-subscribe request received:", {
      hasEndpoint: !!endpoint,
      hasLeaderId: !!leader_id,
      channel,
      hasNativeToken: !!native_token,
    });

    // Validate required fields
    if (!leader_id) {
      console.error("Missing leader_id in request");
      return new Response(
        JSON.stringify({ error: "Leader ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (channel === "web") {
      if (!endpoint) {
        return new Response(
          JSON.stringify({ error: "Endpoint is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!p256dh || !auth) {
        return new Response(
          JSON.stringify({ error: "Subscription keys (p256dh, auth) are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      if (!native_token) {
        return new Response(
          JSON.stringify({ error: "native_token is required for native subscriptions" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    console.log(`Saving ${channel} push subscription for leader ${leader.id}`);

    // Use a stable endpoint identifier for native tokens so upserts work.
    const effectiveEndpoint = channel === "apns"
      ? (endpoint || `apns://${native_token}`)
      : endpoint;

    const row: Record<string, unknown> = {
      leader_id: leader.id,
      endpoint: effectiveEndpoint,
      channel,
      native_token: channel === "apns" ? native_token : null,
      platform,
      last_used_at: new Date().toISOString(),
    };
    if (channel === "web") {
      row.p256dh = p256dh;
      row.auth = auth;
    } else {
      // Keep columns non-null-friendly for legacy rows but harmless for new rows.
      row.p256dh = null;
      row.auth = null;
    }

    const { error: insertError } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(row, { onConflict: "endpoint" });

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
