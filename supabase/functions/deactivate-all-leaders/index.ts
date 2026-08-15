import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve caller's leader row
    const userId = claimsData.claims.sub;
    const { data: leaderRow } = await admin
      .from("leaders")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!leaderRow) {
      return new Response(JSON.stringify({ error: "Leader not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("leader_id", leaderRow.id)
      .in("role", ["admin", "superadmin"])
      .limit(1)
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updErr } = await admin
      .from("leaders")
      .update({ is_active: false })
      .eq("is_active", true).eq("is_external", false).not("name", "ilike", "%bengt simonsen%")
      .select("id");

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leaderIds = (updated ?? []).map((r: { id: string }) => r.id);
    let notified = 0;
    if (leaderIds.length > 0) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/push-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            title: "Off-season er i gang 🌙",
            message:
              "Sesongen er over! Du har fortsatt tilgang til Lederhuset, Tinder, POV, slurker og lederpasset ditt.",
            url: "/",
            leader_ids: leaderIds,
            sender_leader_id: leaderRow.id,
            include_inactive: true,
          }),
        });
        const pushJson = await res.json().catch(() => null);
        notified = pushJson?.sent ?? 0;
      } catch (pushErr) {
        console.error("off-season push failed:", pushErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, deactivated: leaderIds.length, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("deactivate-all-leaders error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
