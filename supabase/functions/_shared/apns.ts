const encoder = new TextEncoder();

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

export function isApnsConfigured(): boolean {
  return !!(
    Deno.env.get("APNS_KEY_ID") &&
    Deno.env.get("APNS_TEAM_ID") &&
    Deno.env.get("APNS_PRIVATE_KEY")
  );
}

async function createApnsJwt(): Promise<string> {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");

  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNs is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) {
    return cachedJwt.token;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64UrlEncode(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(signingInput),
    ),
  );

  const token = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
}

export async function sendApplePush(
  deviceToken: string,
  title: string,
  body: string,
  url = "/",
): Promise<void> {
  const topic = Deno.env.get("APNS_TOPIC") || "com.oksnoen.lederapp";
  const environment = Deno.env.get("APNS_ENV") || "production";
  const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const jwt = await createApnsJwt();

  const response = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
      },
      url,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`APNs ${response.status}: ${details}`);
  }
}
