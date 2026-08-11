// Shared helpers for hashing/verifying admin PIN codes (PBKDF2-SHA256).

const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const salt = fromHex(parts[2]);
  const hash = await derive(pin, salt);
  // constant-time-ish comparison
  if (hash.length !== parts[3].length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return diff === 0;
}