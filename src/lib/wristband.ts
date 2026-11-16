// QR-armbånd: båndet har bare et nummer. QR-koden er en kort lenke som slutter
// på /b/<nummer>, f.eks. https://app.oksnoen.com/b/04827.

export const WRISTBAND_BASE_URL = 'https://app.oksnoen.com/b/';

const MAX_DIGITS = 10;

/** Bare sifre, uten ledende nuller. Tom streng hvis ingenting er igjen. */
export function normalizeWristbandCode(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits.length > MAX_DIGITS ? '' : digits;
}

/**
 * Leser det som står i en QR-kode eller i tallfeltet.
 * Godtar en lenke som slutter på /b/<siffer>, eller bare siffer.
 * Alt annet (andre QR-koder) gir null.
 */
export function parseWristbandCode(text: string | null | undefined): string | null {
  const value = (text ?? '').trim();
  if (!value) return null;

  let digits: string | null = null;
  if (/^\d{1,10}$/.test(value)) {
    digits = value;
  } else {
    const match = value.match(/\/b\/(\d{1,10})\/?(?:[?#].*)?$/i);
    if (match) digits = match[1];
  }
  if (digits === null) return null;

  const code = normalizeWristbandCode(digits);
  return code || null;
}

/** Slik nummeret står trykt på båndet: fem sifre med ledende nuller. */
export function formatWristbandCode(code: string): string {
  return code.padStart(5, '0');
}

export function wristbandUrl(code: string | number): string {
  return `${WRISTBAND_BASE_URL}${formatWristbandCode(String(code))}`;
}
