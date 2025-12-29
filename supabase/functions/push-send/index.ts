import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

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
    const { title, message, url, leader_ids, broadcast, sender_leader_id } = body;

    console.log("Push send request received:", { title, broadcast, sender_leader_id });

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for all operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify sender is an admin (using sender_leader_id from the request)
    if (!sender_leader_id) {
      console.log("No sender_leader_id provided");
      return new Response(
        JSON.stringify({ error: "Sender leader ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("leader_id", sender_leader_id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.log("User is not an admin:", sender_leader_id);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin verified:", sender_leader_id);

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

    // Configure web-push with VAPID details
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        sent++;
        console.log(`Successfully sent to subscription ${sub.id}`);
      } catch (error: unknown) {
        failed++;
        const statusCode = (error as { statusCode?: number })?.statusCode;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        console.error(`Failed to send to ${sub.endpoint}:`, errorMessage, "Status:", statusCode);
        
        // Mark dead subscriptions (404, 410)
        if (statusCode === 404 || statusCode === 410) {
          deadSubscriptions.push(sub.id);
        }
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
