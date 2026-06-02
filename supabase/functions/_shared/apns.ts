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

function normalizeSecretValue(value: string | null | undefined): string | null {
  if (!value) return null;
  let normalized = value.trim();

  const eqIndex = normalized.indexOf("=");
  if (eqIndex > 0 && /^[A-Z0-9_]+$/i.test(normalized.slice(0, eqIndex))) {
    normalized = normalized.slice(eqIndex + 1).trim();
  }

  // Strip any leading '=' characters (common paste mistake where the
  // value was copied with the '=' separator still attached).
  while (normalized.startsWith("=")) {
    normalized = normalized.slice(1).trim();
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized || null;
}

export function getApnsConfig(): ApnsConfig | null {
  const keyId = normalizeSecretValue(Deno.env.get("APNS_KEY_ID"));
  const teamId = normalizeSecretValue(Deno.env.get("APNS_TEAM_ID"));
  const privateKeyPem = normalizeSecretValue(Deno.env.get("APNS_PRIVATE_KEY"));
  if (!keyId || !teamId || !privateKeyPem) return null;
  const topic = normalizeSecretValue(Deno.env.get("APNS_TOPIC")) || "com.oksnoen.lederapp";
  const env = (normalizeSecretValue(Deno.env.get("APNS_ENV")) || "production").toLowerCase() === "sandbox"
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

// Some Web Crypto runtimes return ECDSA signatures in DER (ASN.1) instead of
// raw IEEE P1363 (r||s). Apple's APNs JWT requires raw 64-byte (R||S) format.
// This helper normalizes either format to the required 64 bytes.
function ecdsaSignatureToJoseRaw(sig: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(sig);
  // Already raw r||s for P-256
  if (bytes.length === 64) return bytes;

  // Try to parse as DER: 0x30 len 0x02 rLen r 0x02 sLen s
  if (bytes[0] !== 0x30) {
    throw new Error(`Unexpected ECDSA signature format, length=${bytes.length}`);
  }
  let offset = 2;
  // Handle long-form length (>=128)
  if ((bytes[1] & 0x80) !== 0) {
    offset = 2 + (bytes[1] & 0x7f);
  }
  if (bytes[offset] !== 0x02) throw new Error("Invalid DER: expected INTEGER for R");
  const rLen = bytes[offset + 1];
  let rStart = offset + 2;
  let r = bytes.slice(rStart, rStart + rLen);

  const sOffset = rStart + rLen;
  if (bytes[sOffset] !== 0x02) throw new Error("Invalid DER: expected INTEGER for S");
  const sLen = bytes[sOffset + 1];
  const sStart = sOffset + 2;
  let s = bytes.slice(sStart, sStart + sLen);

  // Strip leading zero pad and left-pad to 32 bytes
  const trim = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0x00) i++;
    return b.slice(i);
  };
  const pad32 = (b: Uint8Array) => {
    if (b.length > 32) throw new Error(`ECDSA component too long: ${b.length}`);
    const out = new Uint8Array(32);
    out.set(b, 32 - b.length);
    return out;
  };
  r = pad32(trim(r));
  s = pad32(trim(s));
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
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

  const rawSig = ecdsaSignatureToJoseRaw(sig);
  const token = `${signingInput}.${b64urlEncode(rawSig)}`;
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

  // Surface diagnostic info (no secrets) so misconfig is easy to spot in logs.
  console.error(
    `[APNs] send failed status=${res.status} reason=${reason ?? "?"} ` +
      `env=${cfg.env} topic=${cfg.topic} kid=${cfg.keyId} team=${cfg.teamId} ` +
      `tokenPrefix=${deviceToken.slice(0, 8)}…`,
  );
  // If Apple rejects the provider token, drop the JWT cache so the next call re-signs.
  if (reason === "InvalidProviderToken" || reason === "ExpiredProviderToken") {
    cachedToken = null;
  }

  const unregistered = res.status === 410 ||
    reason === "Unregistered" ||
    reason === "BadDeviceToken" ||
    reason === "DeviceTokenNotForTopic";

  return { ok: false, status: res.status, reason, unregistered };
}