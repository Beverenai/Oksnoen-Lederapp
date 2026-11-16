// Utseende for aktiviteter i velgeren: et symbol og en farge per aktivitet.

const SYMBOLS: [RegExp, string][] = [
  [/pil|bue/, '🏹'],
  [/skriker|svøm|svom/, '🏊'],
  [/tube/, '🛟'],
  [/meter|stup/, '💦'],
  [/taubane|zip/, '🚡'],
  [/vannski|wake/, '🎿'],
  [/triatlon/, '🏅'],
  [/klatr|buldr/, '🧗'],
  [/bruskasse/, '📦'],
  [/rappis|rappell/, '🪢'],
  [/outboard|motorbåt|båtfører/, '🚤'],
  [/kano|kajakk/, '🛶'],
  [/seil/, '⛵'],
  [/fisk/, '🎣'],
  [/ro(ing|båt)?$|robåt/, '🚣'],
  [/sup|padle|surf/, '🏄'],
  [/fotball/, '⚽'],
  [/volley/, '🏐'],
  [/tur|orient|natursti/, '🧭'],
  [/bål|mat|grill/, '🔥'],
];

const COLORS = [
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
];

export function activitySymbol(title: string): string {
  const t = title.toLowerCase();
  for (const [pattern, symbol] of SYMBOLS) if (pattern.test(t)) return symbol;
  return '⭐';
}

export function activityColor(title: string): string {
  let hash = 0;
  for (const ch of title.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
