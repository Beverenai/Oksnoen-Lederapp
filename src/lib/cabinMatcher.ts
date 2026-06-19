export interface CabinLite {
  id: string;
  name: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parse a free-text cabin assignment ("Marcusbu + Hulder & Bedewins")
 * into a list of cabin ids by splitting on `+` and `&`.
 *
 * Cabin names that themselves contain `+` or `&` (e.g. "Skyss II + III")
 * are protected before splitting so they stay intact.
 *
 * Each token is matched against the cabins table:
 *   1. exact match (case-insensitive)
 *   2. all cabins whose name starts with the token (e.g. "Marcusbu" →
 *      "Marcusbu front" + "Marcusbu bak")
 *   3. substring match (token contains cabin name or vice versa)
 */
export function matchCabinIds(text: string | null | undefined, cabins: CabinLite[]): string[] {
  if (!text) return [];
  let working = String(text);

  // 1) Protect cabin names containing + or & with placeholders
  const placeholders = new Map<string, string>();
  cabins.forEach((c, i) => {
    if (!/[+&]/.test(c.name)) return;
    const ph = `\u0000CAB${i}\u0000`;
    const re = new RegExp(escapeRegex(c.name).replace(/\s+/g, '\\s*'), 'gi');
    if (re.test(working)) {
      working = working.replace(re, ph);
      placeholders.set(ph, c.id);
    }
  });

  // 2) Split on + and & (with optional surrounding whitespace and commas)
  const parts = working
    .split(/\s*[+&,]\s*|\s+og\s+/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  const ids: string[] = [];
  for (const part of parts) {
    if (placeholders.has(part)) {
      ids.push(placeholders.get(part)!);
      continue;
    }
    const lower = norm(part);
    if (!lower) continue;

    // exact
    const exact = cabins.filter((c) => norm(c.name) === lower);
    if (exact.length > 0) {
      exact.forEach((c) => ids.push(c.id));
      continue;
    }
    // startsWith (e.g. "Marcusbu" → "Marcusbu front" + "Marcusbu bak")
    const starts = cabins.filter((c) => {
      const n = norm(c.name);
      return n === lower || n.startsWith(lower + ' ');
    });
    if (starts.length > 0) {
      starts.forEach((c) => ids.push(c.id));
      continue;
    }
    // substring fallback
    const sub = cabins.filter((c) => {
      const n = norm(c.name);
      return n.includes(lower) || lower.includes(n);
    });
    if (sub.length > 0) {
      sub.forEach((c) => ids.push(c.id));
    }
  }

  return Array.from(new Set(ids));
}