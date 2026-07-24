import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  type PushSubscription,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";
import { getApnsConfig, sendApnsAlert } from "../_shared/apns.ts";

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

// Convert VAPID keys from base64url to CryptoKeyPair using Web Crypto API
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
    const body = await req.json();
    const { title, message, url, leader_ids, broadcast, sender_leader_id, target_activity, single_leader_id, personalize_activity, target_unread_with_content } = body;

    console.log("Push send request received:", { title, broadcast, sender_leader_id, target_activity, single_leader_id, personalize_activity, target_unread_with_content });

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

    // In "inactive" app mode, all leaders should receive notifications
    // regardless of their is_active flag (off-season broadcasts).
    const { data: appModeRow } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "app_mode")
      .maybeSingle();
    const isAppInactive = (appModeRow?.value ?? "active") === "inactive";
    console.log(`App mode: ${isAppInactive ? "inactive (skip is_active filter)" : "active"}`);

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
      .in("role", ["admin", "superadmin"])
      .limit(1)
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
    const apnsCfg = getApnsConfig();

    let appServer: Awaited<ReturnType<typeof ApplicationServer.new>> | null = null;
    if (vapidPublicKey && vapidPrivateKey) {
      const vapidKeys = await importVapidKeysToCryptoKeyPair(vapidPublicKey, vapidPrivateKey);
      appServer = await ApplicationServer.new({
        contactInformation: vapidSubject,
        vapidKeys: vapidKeys,
      });
    } else {
      console.warn("VAPID keys not configured — web push will be skipped");
    }
    if (!apnsCfg) {
      console.warn("APNs secrets not configured — native push will be skipped");
    }
    if (!appServer && !apnsCfg) {
      return new Response(
        JSON.stringify({ error: "No push transport configured (VAPID and APNs both missing)" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a map of leader_id -> current_activity for personalization
    let leaderActivityMap: Record<string, string> = {};
    if (personalize_activity) {
      const { data: leaderContent } = await supabaseAdmin
        .from('leader_content')
        .select('leader_id, current_activity');
      
      leaderContent?.forEach(lc => {
        leaderActivityMap[lc.leader_id] = lc.current_activity || 'Sjekk vaktplanen';
      });
      console.log(`Loaded activity map for ${Object.keys(leaderActivityMap).length} leaders`);
    }

    // Handle single leader targeting
    if (single_leader_id) {
      // Skip inactive leaders
      const { data: leaderRow } = await supabaseAdmin
        .from("leaders")
        .select("id")
        .eq("id", single_leader_id)
        .maybeSingle();
      if (leaderRow && !isAppInactive) {
        const { data: activeRow } = await supabaseAdmin
          .from("leaders")
          .select("id")
          .eq("id", single_leader_id)
          .eq("is_active", true)
          .maybeSingle();
        if (!activeRow) {
          return new Response(
            JSON.stringify({ success: true, sent: 0, message: "Leader is inactive" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      if (!leaderRow) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: "Leader is inactive" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: subscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("leader_id", single_leader_id);
      
      if (!subscriptions || subscriptions.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: "Leader has no push subscriptions" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`Sending to single leader ${single_leader_id}: ${subscriptions.length} subscriptions`);
      
      const payloadData = JSON.stringify({ title, body: message, url: url || "/" });
      let sent = 0;
      let failed = 0;
      let nativeSkipped = 0;
      let webSkipped = 0;

      for (const sub of subscriptions) {
        if (sub.channel === "apns") {
          if (!apnsCfg) { nativeSkipped++; continue; }
          const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: message, url: url || "/" });
          if (res.ok) sent++; else { failed++; if (res.unregistered) await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id); }
        } else {
          if (!appServer) { webSkipped++; continue; }
          try {
            const pushSubscription: PushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
            const subscriber = await appServer.subscribe(pushSubscription);
            await subscriber.pushTextMessage(payloadData, { urgency: Urgency.Normal, ttl: 3600 });
            sent++;
          } catch (error: unknown) {
            failed++;
            console.error(`Error sending to ${sub.id}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }
      
      // Save to announcements (wall)
      const { error: insertError } = await supabaseAdmin
        .from('announcements')
        .insert({
          title: title,
          content: message,
          is_active: true,
          target_group: 'Personlig melding',
        });
      
      if (insertError) {
        console.error('Failed to save announcement:', insertError);
      } else {
        console.log('Announcement saved to wall');
      }
      
      return new Response(
        JSON.stringify({ success: true, sent, failed, nativeSkipped, webSkipped }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle activity-based targeting
    let targetLeaderIds: string[] | null = null;
    
    // Handle unread with content targeting (red status)
    if (target_unread_with_content) {
      const { data: leaderContent } = await supabaseAdmin
        .from('leader_content')
        .select('leader_id, current_activity, extra_activity, personal_notes, obs_message')
        .eq('has_read', false);
      
      // Filter to only those with actual content to read (red status)
      const leadersWithContent = leaderContent?.filter(lc => 
        lc.current_activity || lc.extra_activity || lc.personal_notes || lc.obs_message
      ) || [];
      
      targetLeaderIds = leadersWithContent.map(lc => lc.leader_id);
      
      console.log(`Targeting unread with content (red status): ${targetLeaderIds.length} leaders`);
      
      if (targetLeaderIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: "Ingen ledere med ulest info!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (target_activity === 'active' || target_activity === 'free') {
      const { data: leaderContent } = await supabaseAdmin
        .from('leader_content')
        .select('leader_id, current_activity');
      
      targetLeaderIds = leaderContent
        ?.filter(lc => {
          if (target_activity === 'free') {
            return lc.current_activity === 'Fri';
          } else { // active
            return lc.current_activity && lc.current_activity !== 'Fri' && lc.current_activity.trim() !== '';
          }
        })
        .map(lc => lc.leader_id) || [];
      
      // Also update activityMap for personalization if needed
      if (personalize_activity) {
        leaderContent?.forEach(lc => {
          leaderActivityMap[lc.leader_id] = lc.current_activity || 'Sjekk vaktplanen';
        });
      }
      
      console.log(`Filtering by activity '${target_activity}': ${targetLeaderIds.length} leaders matched`);
      
      if (targetLeaderIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: `No leaders with activity status '${target_activity}'` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let query = supabaseAdmin.from("push_subscriptions").select("*");
    
    if (targetLeaderIds) {
      query = query.in("leader_id", targetLeaderIds);
    } else if (!broadcast && leader_ids?.length > 0) {
      query = query.in("leader_id", leader_ids);
    }

    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out subscriptions for inactive leaders
    const uniqueLeaderIds = Array.from(new Set(subscriptions.map(s => s.leader_id)));
    let filteredSubscriptions = subscriptions;
    let inactiveSkipped = 0;
    if (!isAppInactive) {
      const { data: activeLeaders } = await supabaseAdmin
        .from("leaders")
        .select("id")
        .in("id", uniqueLeaderIds)
        .eq("is_active", true);
      const activeSet = new Set((activeLeaders ?? []).map(l => l.id));
      const totalSubs = subscriptions.length;
      filteredSubscriptions = subscriptions.filter(s => activeSet.has(s.leader_id));
      inactiveSkipped = totalSubs - filteredSubscriptions.length;
    }

    console.log(`Sending push to ${filteredSubscriptions.length}/${totalSubs} subscriptions (skipped ${inactiveSkipped} inactive), personalize: ${personalize_activity}`);

    let sent = 0;
    let failed = 0;
    const deadSubscriptions: string[] = [];
    let nativeSkipped = 0;
    let webSkipped = 0;

    for (const sub of filteredSubscriptions) {
      // Personalize message if requested
      let finalMessage = message;
      if (personalize_activity && leaderActivityMap[sub.leader_id]) {
        finalMessage = message.replace('{activity}', leaderActivityMap[sub.leader_id]);
      }

      if (sub.channel === "apns") {
        if (!apnsCfg) { nativeSkipped++; continue; }
        const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: finalMessage, url: url || "/" });
        if (res.ok) {
          sent++;
        } else {
          failed++;
          console.error(`APNs send failed for ${sub.id}: ${res.status} ${res.reason ?? ""}`);
          if (res.unregistered) deadSubscriptions.push(sub.id);
        }
        continue;
      }

      if (!appServer) { webSkipped++; continue; }
      try {
        const payloadData = JSON.stringify({ title, body: finalMessage, url: url || "/" });
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        const subscriber = await appServer.subscribe(pushSubscription);
        await subscriber.pushTextMessage(payloadData, { urgency: Urgency.Normal, ttl: 3600 });
        sent++;
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

    // Save to announcements (wall)
    let targetGroup = 'Alle ledere';
    if (target_unread_with_content) {
      targetGroup = 'Ledere med ulest info';
    } else if (target_activity === 'active') {
      targetGroup = 'Ledere på aktivitet';
    } else if (target_activity === 'free') {
      targetGroup = 'Ledere med fri';
    }
    
    // For wall display, use generalized message (replace {activity} placeholder)
    const wallMessage = personalize_activity 
      ? message.replace('{activity}', 'din aktivitet')
      : message;
    
    const { error: insertError } = await supabaseAdmin
      .from('announcements')
      .insert({
        title: title,
        content: wallMessage,
        is_active: true,
        target_group: targetGroup,
      });
    
    if (insertError) {
      console.error('Failed to save announcement:', insertError);
    } else {
      console.log('Announcement saved to wall with target_group:', targetGroup);
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, removed: deadSubscriptions.length, nativeSkipped, webSkipped, inactiveSkipped }),
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
