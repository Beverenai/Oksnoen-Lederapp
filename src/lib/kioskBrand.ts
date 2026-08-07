/**
 * Brand marks for Gomla products.
 * Each product gets a small circular emblem with brand-ish colours and a short mark,
 * so leaders recognise varen på farge/merke uten å lese hele navnet.
 */
export interface BrandMark {
  /** Short text shown inside the emblem (1-3 chars). */
  mark: string;
  /** Emblem background colour. */
  bg: string;
  /** Emblem text colour. */
  fg: string;
  /** Optional emoji shown instead of text. */
  emoji?: string;
}

const RULES: Array<{ test: RegExp; mark: BrandMark }> = [
  // Brus
  { test: /cola zero|pepsi/i, mark: { mark: 'P', bg: '#0a2a6b', fg: '#ffffff' } },
  { test: /cola/i, mark: { mark: 'C', bg: '#e2231a', fg: '#ffffff' } },
  { test: /fanta/i, mark: { mark: 'F', bg: '#ff7a00', fg: '#ffffff' } },
  { test: /solo/i, mark: { mark: 'S', bg: '#f5a623', fg: '#3b2200' } },
  { test: /sprite/i, mark: { mark: 'S', bg: '#00a651', fg: '#ffffff' } },
  { test: /urge/i, mark: { mark: 'U', bg: '#7ac943', fg: '#12300a' } },
  { test: /villa/i, mark: { mark: 'V', bg: '#c8102e', fg: '#ffffff' } },
  // Chips
  { test: /cheez|doodle/i, mark: { mark: 'CD', bg: '#ffb200', fg: '#4a2c00' } },
  { test: /kims/i, mark: { mark: 'K', bg: '#d4001a', fg: '#ffffff' } },
  { test: /gullchips|petters/i, mark: { mark: 'PG', bg: '#e6b400', fg: '#3d2f00' } },
  // Godteri
  { test: /gott ?& ?blandat/i, mark: { mark: 'G&B', bg: '#e5006d', fg: '#ffffff' } },
  { test: /knattar/i, mark: { mark: 'KN', bg: '#6d28d9', fg: '#ffffff' } },
  { test: /bubs/i, mark: { mark: 'B', bg: '#00a3e0', fg: '#ffffff' } },
  { test: /fizzy/i, mark: { mark: 'FZ', bg: '#22c55e', fg: '#08290f' } },
  { test: /haribo|roulette/i, mark: { mark: 'H', bg: '#ffd400', fg: '#5c4300' } },
  { test: /maoam/i, mark: { mark: 'M', bg: '#ff4d00', fg: '#ffffff' } },
  { test: /vepsebol/i, mark: { mark: '', emoji: '🐝', bg: '#facc15', fg: '#3f2d00' } },
  { test: /love hearts/i, mark: { mark: '', emoji: '💗', bg: '#fda4d0', fg: '#5c0030' } },
  { test: /pinne/i, mark: { mark: '', emoji: '🍭', bg: '#f472b6', fg: '#4a0026' } },
  // Sjokolade
  { test: /kvikk/i, mark: { mark: 'KL', bg: '#d81e05', fg: '#ffffff' } },
  { test: /kinder bueno/i, mark: { mark: 'KB', bg: '#5b3a1e', fg: '#ffd7a3' } },
  { test: /kinder/i, mark: { mark: 'K', bg: '#c8102e', fg: '#ffffff' } },
  { test: /stratos/i, mark: { mark: 'ST', bg: '#0057b8', fg: '#ffffff' } },
  { test: /japp/i, mark: { mark: 'J', bg: '#8b1a1a', fg: '#ffd166' } },
  { test: /twix/i, mark: { mark: 'TX', bg: '#7a4b12', fg: '#ffd98a' } },
  { test: /toppris/i, mark: { mark: 'TP', bg: '#1f3b73', fg: '#ffffff' } },
  { test: /krokanrull/i, mark: { mark: 'KR', bg: '#b45309', fg: '#fff2d6' } },
  { test: /melkerull/i, mark: { mark: 'MR', bg: '#1d4ed8', fg: '#ffffff' } },
  { test: /smil/i, mark: { mark: '', emoji: '🙂', bg: '#fbbf24', fg: '#402c00' } },
];

const CATEGORY_FALLBACK: Record<string, BrandMark> = {
  brus: { mark: '', emoji: '🥤', bg: '#38bdf8', fg: '#062b3d' },
  chips: { mark: '', emoji: '🥨', bg: '#fbbf24', fg: '#402c00' },
  godteri: { mark: '', emoji: '🍬', bg: '#f472b6', fg: '#4a0026' },
  sjokolade: { mark: '', emoji: '🍫', bg: '#92400e', fg: '#ffe9c7' },
  is: { mark: '', emoji: '🍦', bg: '#a5b4fc', fg: '#1e1b4b' },
};

export function getBrandMark(productName: string, categoryName?: string | null): BrandMark {
  const hit = RULES.find((r) => r.test.test(productName));
  if (hit) return hit.mark;

  const fallback = categoryName ? CATEGORY_FALLBACK[categoryName.toLowerCase()] : undefined;
  if (fallback) return fallback;

  return {
    mark: productName.trim().charAt(0).toUpperCase() || '?',
    bg: '#e2e8f0',
    fg: '#1f2937',
  };
}
