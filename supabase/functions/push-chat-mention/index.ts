// Varsler ledere som er tagget med "@Navn" i Lederhuset-chatten.
//
// Klienten sender bare message_id. Avsender, kanal og mottakere leses
// server-side fra raden, og en unik rad i chat_mention_notifications per
// melding er sendelåsen — så ingen kan spoofe eller spamme varsler.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApplicationServer, type PushSubscription, Urgency } from "jsr:@negrel/webpush@0.5.0";
import { getApnsConfig, sendApnsAlert } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importVapidKeys(publicKeyBase64: string, privateKeyBase64: string): Promise<CryptoKeyPair> {
  const publicKeyBytes = base64urlToUint8Array(publicKeyBase64);
  const x = uint8ArrayToBase64url(publicKeyBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(publicKeyBytes.slice(33, 65));
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateKeyBase64 },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  return { publicKey, privateKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const messageId = typeof body?.message_id === "string" ? body.message_id : null;
    if (!messageId) return json({ error: "message_id is required" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: caller } = await supabaseAdmin
      .from("leaders")
      .select("id, name")
      .eq("auth_user_id", claimsData.claims.sub)
      .maybeSingle();
    if (!caller) return json({ error: "Forbidden" }, 403);

    const { data: message } = await supabaseAdmin
      .from("chat_messages")
      .select("id, leader_id, body, channel, mentions, image_path")
      .eq("id", messageId)
      .maybeSingle();
    if (!message) return json({ error: "Not found" }, 404);
    if (message.leader_id !== caller.id) return json({ error: "Forbidden" }, 403);

    const mentioned = ((message.mentions ?? []) as string[]).filter((id) => id !== caller.id);

    // Alle i kanalen varsles for hver melding: Leirskole-staben på den aktive uken,
    // og i Lederhuset alle ledere som er aktive nå.
    let broadcastIds: string[] = [];
    if (message.channel === "leirskole") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: weeks } = await supabaseAdmin
        .from("leirskole_weeks")
        .select("id, start_date, end_date")
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      const list = (weeks ?? []) as Array<{ id: string; start_date: string; end_date: string }>;
      const week =
        list.find((w) => w.start_date <= today && w.end_date >= today) ??
        list.find((w) => w.start_date > today) ??
        list[list.length - 1];
      if (week) {
        const { data: staff } = await supabaseAdmin
          .from("leirskole_staff")
          .select("leader_id")
          .eq("week_id", week.id);
        broadcastIds = (staff ?? [])
          .map((s) => s.leader_id as string)
          .filter((id) => id && id !== caller.id);
      }
    } else {
      const { data: active } = await supabaseAdmin
        .from("leaders")
        .select("id")
        .eq("is_active", true);
      broadcastIds = (active ?? [])
        .map((l) => l.id as string)
        .filter((id) => id && id !== caller.id);
    }

    const targetIds = Array.from(new Set([...mentioned, ...broadcastIds]));
    if (targetIds.length === 0) return json({ success: true, sent: 0, reason: "no recipients" });

    // Sendelås — én rad per melding.
    const { error: lockError } = await supabaseAdmin
      .from("chat_mention_notifications")
      .insert({ message_id: message.id });
    if (lockError) return json({ success: true, sent: 0, reason: "already sent" });

    // Eksterne "ledere" (kun navn i klinelista) har ingen konto å varsle.
    const { data: recipients } = await supabaseAdmin
      .from("leaders")
      .select("id")
      .in("id", targetIds)
      .or("is_external.is.null,is_external.eq.false");
    const recipientIds = (recipients ?? []).map((r) => r.id as string);
    if (recipientIds.length === 0) return json({ success: true, sent: 0, reason: "no accounts" });
    const mentionedSet = new Set(mentioned);

    const rawBody = String(message.body ?? "").trim();
    const hasImage = !!(message as { image_path?: string | null }).image_path;
    const preview = rawBody
      ? `${hasImage ? "📷 " : ""}${rawBody.slice(0, 120)}`
      : hasImage
        ? "📷 Sendte et bilde"
        : "Ny melding i Lederhuset";
    const channelLabel = message.channel === "leirskole" ? "Leirskole" : "Lederhuset";
    const titleFor = (leaderId: string) =>
      mentionedSet.has(leaderId)
        ? `💬 ${caller.name} tagget deg`
        : `💬 ${caller.name} i ${channelLabel}`;
    const url = "/chat";

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@oksnoen.com";
    const apnsCfg = getApnsConfig();
    let appServer: Awaited<ReturnType<typeof ApplicationServer.new>> | null = null;
    if (vapidPublicKey && vapidPrivateKey) {
      appServer = await ApplicationServer.new({
        contactInformation: vapidSubject,
        vapidKeys: await importVapidKeys(vapidPublicKey, vapidPrivateKey),
      });
    }
    if (!appServer && !apnsCfg) return json({ error: "No push transport configured" }, 503);

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("leader_id", recipientIds);

    let sent = 0;
    let failed = 0;

    for (const sub of (subscriptions ?? []) as Array<Record<string, string>>) {
      const { data: badgeData } = await supabaseAdmin.rpc("get_my_unread_badge", {
        _leader_id: sub.leader_id,
      });
      const badge = Number(badgeData) || 0;
      const title = titleFor(sub.leader_id);

      if (sub.channel === "apns") {
        if (!apnsCfg) continue;
        const res = await sendApnsAlert(apnsCfg, sub.native_token, { title, body: preview, url, badge });
        if (res.ok) sent++;
        else {
          failed++;
          if (res.unregistered) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      } else {
        if (!appServer) continue;
        try {
          const pushSubscription: PushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          const subscriber = await appServer.subscribe(pushSubscription);
          await subscriber.pushTextMessage(
            JSON.stringify({ title, body: preview, url, badge }),
            { urgency: Urgency.Normal, ttl: 3600 },
          );
          sent++;
        } catch (e) {
          failed++;
          console.error(`web push failed for ${sub.id}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }

    console.log(`push-chat-mention ${message.id}: recipients=${recipientIds.length} sent=${sent} failed=${failed}`);
    return json({ success: true, sent, failed });
  } catch (error) {
    console.error("push-chat-mention error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});