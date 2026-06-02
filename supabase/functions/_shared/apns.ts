// Shared APNs helper for sending push notifications to iOS devices.
// Uses Apple's HTTP/2 APNs API with ES256 JWT auth (token-based, not cert-based).
//
// Required env vars:
//   APNS_KEY_ID       - 10 char Key ID from Apple Developer
//   APNS_TEAM_ID      - 10 char Team ID
//   APNS_PRIVATE_KEY  - .p8 contents (PEM, may include BEGIN/END lines)
//   APNS_TOPIC        - bundle id (default com.oksnoen.lederapp)
//   APNS_ENV          - 'production' (default) or 'sandbox'

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  privateKeyPem: string;
  topic: string;
  env: "production" | "sandbox";
}

export interface ApnsAlertPayload {
  title: string;
  body: string;
  url?: string;
  badge?: number;
  sound?: string;
}

export interface ApnsSendResult {
  ok: boolean;
  status: number;
  reason?: string;
  /** True when Apple says the token is invalid and should be removed. */
  unregistered?: boolean;
}

export function getApnsConfig(): ApnsConfig | null {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !privateKeyPem) return null;
  const topic = Deno.env.get("APNS_TOPIC") || "com.oksnoen.lederapp";
  const env = (Deno.env.get("APNS_ENV") || "production").toLowerCase() === "sandbox"
    ? "sandbox"
    : "production";
  return { keyId, teamId, privateKeyPem, topic, env };
}

function b64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlString(input: string): string {
  return b64urlEncode(new TextEncoder().encode(input));
}

function pemToPkcs8Bytes(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Cache the signed JWT for up to ~50 minutes (Apple allows max 60 min, min 20 min refresh).
let cachedToken: { token: string; iat: number; keyId: string } | null = null;

async function createApnsJwt(cfg: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.keyId === cfg.keyId && now - cachedToken.iat < 50 * 60) {
    return cachedToken.token;
  }

  const header = { alg: "ES256", kid: cfg.keyId, typ: "JWT" };
  const claims = { iss: cfg.teamId, iat: now };
  const signingInput = `${b64urlString(JSON.stringify(header))}.${b64urlString(JSON.stringify(claims))}`;

  const pkcs8 = pemToPkcs8Bytes(cfg.privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  const token = `${signingInput}.${b64urlEncode(sig)}`;
  cachedToken = { token, iat: now, keyId: cfg.keyId };
  return token;
}

export async function sendApnsAlert(
  cfg: ApnsConfig,
  deviceToken: string,
  payload: ApnsAlertPayload,
): Promise<ApnsSendResult> {
  const host = cfg.env === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  const url = `${host}/3/device/${deviceToken}`;

  const jwt = await createApnsJwt(cfg);

  const apsPayload: Record<string, unknown> = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
  };
  if (payload.url) apsPayload.url = payload.url;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "authorization": `bearer ${jwt}`,
        "apns-topic": cfg.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(apsPayload),
    });
  } catch (e) {
    return { ok: false, status: 0, reason: (e as Error).message };
  }

  if (res.status === 200) {
    return { ok: true, status: 200 };
  }

  let reason: string | undefined;
  try {
    const j = await res.json();
    reason = j?.reason;
  } catch {
    // ignore
  }

  const unregistered = res.status === 410 ||
    reason === "Unregistered" ||
    reason === "BadDeviceToken" ||
    reason === "DeviceTokenNotForTopic";

  return { ok: false, status: res.status, reason, unregistered };
}