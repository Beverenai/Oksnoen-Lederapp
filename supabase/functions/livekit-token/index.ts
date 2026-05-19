import { createClient } from "npm:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const channelId: string | undefined = body?.channel_id;
    if (!channelId || typeof channelId !== "string") {
      return new Response(JSON.stringify({ error: "channel_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up leader row for the authenticated user
    const { data: leader, error: leaderErr } = await supabase
      .from("leaders")
      .select("id, name, profile_image_url")
      .eq("auth_user_id", claimsData.claims.sub)
      .maybeSingle();

    if (leaderErr || !leader) {
      return new Response(JSON.stringify({ error: "Leader profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify channel exists & user has access (RLS will filter rows the user can see)
    const { data: channel, error: channelErr } = await supabase
      .from("walkie_channels")
      .select("id, name")
      .eq("id", channelId)
      .maybeSingle();

    if (channelErr || !channel) {
      return new Response(JSON.stringify({ error: "Channel not accessible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomName = `channel_${channelId}`;
    const parts = (leader.name || "").trim().split(/\s+/).filter(Boolean);
    const displayName = parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : (parts[0] || "Leder");
    const metadata = JSON.stringify({ avatar_url: leader.profile_image_url ?? null });
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    const now = Math.floor(Date.now() / 1000);
    const jwt = await create(
      { alg: "HS256", typ: "JWT" },
      {
        iss: apiKey,
        sub: leader.id,
        name: displayName,
        metadata,
        nbf: now,
        iat: now,
        exp: now + 60 * 60,
        video: {
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
      },
      cryptoKey,
    );

    return new Response(
      JSON.stringify({ token: jwt, url, room: roomName, identity: leader.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("livekit-token error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});