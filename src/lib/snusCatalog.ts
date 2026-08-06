export type SnusStrength = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SnusFormat = 'slim' | 'mini' | 'porsjon' | 'løs';

export interface SnusProduct {
  id: string;
  brand: string;
  variant: string;
  flavor: string;
  /** Accent colour used on the lid arc and side band */
  accent: string;
  /** true = helhvit/white portion, false = brun/original */
  white: boolean;
  strength: SnusStrength;
  format?: SnusFormat;
  /** Epok "No" number shown big on the lid */
  number?: number;
  nicotineFree?: boolean;
}

export interface SnusBrandGroup {
  brand: string;
  products: SnusProduct[];
}

const epok = (
  id: string,
  number: number | null,
  variant: string,
  flavor: string,
  accent: string,
  strength: SnusStrength,
  format: SnusFormat = 'slim',
  nicotineFree = false,
): SnusProduct => ({
  id,
  brand: 'Epok',
  variant,
  flavor,
  accent,
  white: true,
  strength,
  format,
  number: number ?? undefined,
  nicotineFree,
});

const EPOK: SnusProduct[] = [
  epok('epok-no1', 1, 'No1 Ice Blue', 'Mint', '#2f6fd0', 4),
  epok('epok-no2', 2, 'No2 Arctic Blue', 'Mint', '#4c93e0', 2),
  epok('epok-no3', 3, 'No3 Zest Green', 'Sitrus & mint', '#5aa832', 4),
  epok('epok-no4', 4, 'No4 Purple', 'Bringebær & lakris', '#6b3fa0', 4),
  epok('epok-no5', 5, 'No5 Tropic Breeze', 'Tropisk frukt', '#e8862a', 2),
  epok('epok-no7', 7, 'No7 Freeze', 'Ekstra kald mint', '#0e5fa8', 5),
  epok('epok-no9', 9, 'No9 Urban Blue', 'Mint', '#1f4f9c', 5),
  epok('epok-no11', 11, 'No11 Frosty Green', 'Spearmint', '#2f9c6a', 2),
  epok('epok-no12', 12, 'No12 Frosty Green Mini', 'Spearmint', '#2f9c6a', 2, 'mini'),
  epok('epok-no19', 19, 'No19 Ice Blue Mini', 'Mint', '#2f6fd0', 2, 'mini'),
  epok('epok-no20', 20, 'No20 Freeze', 'Iskald mint', '#0b4f92', 6),
  epok('epok-no21', 21, 'No21 Freeze', 'Iskald mint', '#08375f', 7),
  epok('epok-no23', 23, 'No23 Mountain Storm', 'Mint & eukalyptus', '#13606b', 7),
  epok('epok-no26', 26, 'No26 Jalapeno Lime', 'Chili & lime', '#7fae2a', 6),
  epok('epok-no27', 27, 'No27 Pink Burst', 'Bær', '#d6417e', 2),
  epok('epok-no28', 28, 'No28 Strawberry Ice', 'Jordbær & mint', '#d63a4a', 3),
  epok('epok-no32', 32, 'No32 Frosty Green', 'Spearmint', '#1f8a5c', 4),
  epok('epok-no34', 34, 'No34 Spicy Dragon Fruit', 'Dragefrukt & chili', '#c62f6b', 3),
  epok('epok-no35', 35, 'No35 Spicy Peach', 'Fersken & chili', '#e0743a', 3),
  epok('epok-no36', 36, 'No36 Strawberry Mini', 'Jordbær', '#d63a4a', 2, 'mini'),
  epok('epok-no37', 37, 'No37 Ice Blue', 'Mint', '#123f7a', 7),
  epok('epok-no38', 38, 'No38 Icy Berries Mini', 'Bær & mint', '#8a3f9c', 2, 'mini'),
  epok('epok-no39', 39, 'No39 Smooth Peppermint Mini', 'Peppermynte', '#3aa6a0', 2, 'mini'),
  epok('epok-no40', 40, 'No40 Smooth Peppermint', 'Peppermynte', '#1f7f7a', 7),
  epok('epok-no41', 41, 'No41 Smooth Peppermint', 'Peppermynte', '#3aa6a0', 3),
  epok('epok-no42', 42, 'No42 Tangy Lime Mini', 'Lime', '#9cbf2a', 2, 'mini'),
  epok('epok-no43', 43, 'No43 Spearmint Storm', 'Spearmint', '#0f7a4c', 7),
  epok('epok-no44', 44, 'No44 Guava Jalapeno', 'Guava & chili', '#c9552f', 6),
  epok('epok-no46', 46, 'No46 Blueberry Ice', 'Blåbær & mint', '#3a4a9c', 3),
  epok('epok-no47', 47, 'No47 Minty Lemon', 'Sitron & mint', '#c9b32a', 4),
  epok('epok-no102', 102, 'No102 Dark Original', 'Tobakk', '#3a2b22', 3, 'porsjon'),
  epok('epok-zero-peppermint', null, 'Peppermint ZERO', 'Peppermynte – nikotinfri', '#2f9c8a', 1, 'slim', true),
  epok('epok-zero-smooth-peppermint', null, 'Smooth Peppermint ZERO', 'Peppermynte – nikotinfri', '#3aa6a0', 1, 'slim', true),
  epok('epok-zero-watermelon', null, 'Wintry Watermelon ZERO', 'Vannmelon – nikotinfri', '#d6417e', 1, 'slim', true),
  epok('epok-zero-mango', null, 'Breezy Mango ZERO', 'Mango – nikotinfri', '#e8a02a', 1, 'slim', true),
];

const OTHERS: SnusProduct[] = [
  // ---- General ----
  { id: 'general-white-portion', brand: 'General', variant: 'White Portion', flavor: 'Klassisk tobakk', accent: '#1f4e79', white: true, strength: 2, format: 'porsjon' },
  { id: 'general-original-portion', brand: 'General', variant: 'Original Portion', flavor: 'Klassisk tobakk', accent: '#123a5c', white: false, strength: 2, format: 'porsjon' },
  { id: 'general-mint-white', brand: 'General', variant: 'Mint White', flavor: 'Mint', accent: '#1f8a6d', white: true, strength: 2, format: 'porsjon' },
  { id: 'general-extra-strong', brand: 'General', variant: 'Extra Strong White', flavor: 'Klassisk tobakk', accent: '#0b2740', white: true, strength: 4, format: 'porsjon' },
  { id: 'general-g3', brand: 'General', variant: 'G.3 Slim', flavor: 'Bergamott & einer', accent: '#2f5f8f', white: true, strength: 3, format: 'slim' },
  { id: 'general-snus-nordic-mint', brand: 'General', variant: 'Nordic Mint Slim', flavor: 'Mint', accent: '#0f7a6a', white: true, strength: 3, format: 'slim' },

  // ---- Skruf ----
  { id: 'skruf-super-white-no53', brand: 'Skruf', variant: 'Super White No53', flavor: 'Fresh Mint', accent: '#1f7a4c', white: true, strength: 3, format: 'slim', number: 53 },
  { id: 'skruf-super-white-no54', brand: 'Skruf', variant: 'Super White No54', flavor: 'Fresh Mint Strong', accent: '#14603b', white: true, strength: 4, format: 'slim', number: 54 },
  { id: 'skruf-super-white-nordic', brand: 'Skruf', variant: 'Super White Nordic Nights', flavor: 'Lakris & mint', accent: '#2b2f6b', white: true, strength: 4, format: 'slim' },
  { id: 'skruf-super-white-berry', brand: 'Skruf', variant: 'Super White Wild Berries', flavor: 'Skogsbær', accent: '#7b2450', white: true, strength: 3, format: 'slim' },
  { id: 'skruf-slim-fresh', brand: 'Skruf', variant: 'Slim Fresh White', flavor: 'Mint & sitrus', accent: '#2f8f7d', white: true, strength: 2, format: 'slim' },
  { id: 'skruf-original-portion', brand: 'Skruf', variant: 'Original Portion', flavor: 'Tobakk & bergamott', accent: '#123f2d', white: false, strength: 2, format: 'porsjon' },

  // ---- The Lab ----
  { id: 'thelab-1', brand: 'The Lab', variant: 'No 1', flavor: 'Mint', accent: '#3f9ad6', white: true, strength: 1, format: 'slim', number: 1 },
  { id: 'thelab-2', brand: 'The Lab', variant: 'No 2', flavor: 'Mint & eukalyptus', accent: '#2f7fbd', white: true, strength: 2, format: 'slim', number: 2 },
  { id: 'thelab-3', brand: 'The Lab', variant: 'No 3', flavor: 'Kraftig mint', accent: '#1f5f9c', white: true, strength: 3, format: 'slim', number: 3 },
  { id: 'thelab-4', brand: 'The Lab', variant: 'No 4', flavor: 'Mint & lakris', accent: '#173f75', white: true, strength: 4, format: 'slim', number: 4 },
  { id: 'thelab-5', brand: 'The Lab', variant: 'No 5', flavor: 'Ekstra sterk mint', accent: '#10294f', white: true, strength: 5, format: 'slim', number: 5 },
  { id: 'thelab-6', brand: 'The Lab', variant: 'No 6', flavor: 'Ekstrem mint', accent: '#0a1a33', white: true, strength: 6, format: 'slim', number: 6 },

  // ---- Siberia ----
  { id: 'siberia-red-white', brand: 'Siberia', variant: '-80 White Dry', flavor: 'Ekstrem mint', accent: '#b3261e', white: true, strength: 7, format: 'porsjon' },
  { id: 'siberia-blue', brand: 'Siberia', variant: '-80 Blue Slim', flavor: 'Mint', accent: '#1b4fa0', white: true, strength: 6, format: 'slim' },
  { id: 'siberia-brown', brand: 'Siberia', variant: '-80 Brown Portion', flavor: 'Mint & tobakk', accent: '#5b3a1e', white: false, strength: 7, format: 'porsjon' },

  // ---- Loop ----
  { id: 'loop-mango', brand: 'Loop', variant: 'Mango Mist Slim', flavor: 'Mango', accent: '#e08b1f', white: true, strength: 3, format: 'slim' },
  { id: 'loop-jalla', brand: 'Loop', variant: 'Jalla Jalla Slim', flavor: 'Sitrus & mint', accent: '#d0602a', white: true, strength: 3, format: 'slim' },
  { id: 'loop-eucalyptus', brand: 'Loop', variant: 'Eucalyptus Frost', flavor: 'Eukalyptus', accent: '#2f9c8a', white: true, strength: 4, format: 'slim' },
  { id: 'loop-lemon', brand: 'Loop', variant: 'Lemon Bloom', flavor: 'Sitron', accent: '#c9b32a', white: true, strength: 3, format: 'slim' },

  // ---- Odens ----
  { id: 'odens-cold-extreme', brand: 'Odens', variant: 'Cold Extreme White Dry', flavor: 'Mint', accent: '#1e6fa8', white: true, strength: 6, format: 'porsjon' },
  { id: 'odens-double-mint', brand: 'Odens', variant: 'Double Mint Extreme', flavor: 'Dobbel mint', accent: '#0f7a5a', white: true, strength: 6, format: 'porsjon' },
  { id: 'odens-lakrits', brand: 'Odens', variant: 'Lakrits Extreme', flavor: 'Lakris', accent: '#22222a', white: false, strength: 6, format: 'porsjon' },

  // ---- Lundgrens ----
  { id: 'lundgrens-skane', brand: 'Lundgrens', variant: 'Skåne White', flavor: 'Rabarbra & vanilje', accent: '#8a2f4b', white: true, strength: 2, format: 'porsjon' },
  { id: 'lundgrens-jarva', brand: 'Lundgrens', variant: 'Järva White', flavor: 'Bær & mint', accent: '#3a6f2f', white: true, strength: 2, format: 'porsjon' },

  // ---- Ettan ----
  { id: 'ettan-portion', brand: 'Ettan', variant: 'Original Portion', flavor: 'Klassisk tobakk', accent: '#8a6a2f', white: false, strength: 2, format: 'porsjon' },
  { id: 'ettan-white', brand: 'Ettan', variant: 'White Portion', flavor: 'Klassisk tobakk', accent: '#a1802f', white: true, strength: 2, format: 'porsjon' },
  { id: 'ettan-los', brand: 'Ettan', variant: 'Løs', flavor: 'Klassisk tobakk', accent: '#6f5324', white: false, strength: 2, format: 'løs' },

  // ---- Knox ----
  { id: 'knox-white-large', brand: 'Knox', variant: 'White Large', flavor: 'Tobakk & mint', accent: '#2f5b8a', white: true, strength: 3, format: 'porsjon' },
  { id: 'knox-blue-strong', brand: 'Knox', variant: 'Blue Strong White', flavor: 'Mint', accent: '#1b3f6b', white: true, strength: 4, format: 'porsjon' },

  // ---- XR ----
  { id: 'xr-mint', brand: 'XR', variant: 'Mint Slim', flavor: 'Mint', accent: '#1f8a7a', white: true, strength: 3, format: 'slim' },
  { id: 'xr-cool-mint', brand: 'XR', variant: 'Cool Mint Strong', flavor: 'Kald mint', accent: '#14636f', white: true, strength: 4, format: 'slim' },
];

/** Epok first – it is by far the most used */
export const SNUS_CATALOG: SnusProduct[] = [...EPOK, ...OTHERS];

export const SNUS_BRANDS: SnusBrandGroup[] = SNUS_CATALOG.reduce<SnusBrandGroup[]>((acc, p) => {
  const group = acc.find((g) => g.brand === p.brand);
  if (group) group.products.push(p);
  else acc.push({ brand: p.brand, products: [p] });
  return acc;
}, []);

export function getSnusProduct(id?: string | null): SnusProduct | null {
  if (!id) return null;
  return SNUS_CATALOG.find((p) => p.id === id) ?? null;
}

export function snusLabel(productId?: string | null, customLabel?: string | null): string | null {
  const product = getSnusProduct(productId);
  if (product) return `${product.brand} ${product.variant}`;
  if (customLabel?.trim()) return customLabel.trim();
  return null;
}

export function searchSnus(query: string): SnusProduct[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return SNUS_CATALOG;
  const compact = q.replace(/\s/g, '');
  return SNUS_CATALOG.filter((p) => {
    const haystack = `${p.brand} ${p.variant} ${p.flavor} ${p.format ?? ''} ${p.number ? `no${p.number} nr${p.number} ${p.number}` : ''} ${p.white ? 'helhvit white' : 'brun original'} ${p.nicotineFree ? 'nikotinfri zero' : ''} styrke s${p.strength}`
      .toLowerCase();
    return haystack.includes(q) || haystack.replace(/\s/g, '').includes(compact);
  });
}

/** Fallback product used to render a can for a free-text/unknown snus */
export function customSnusProduct(label: string): SnusProduct {
  return {
    id: 'custom',
    brand: label.split(' ')[0] || 'Snus',
    variant: label.split(' ').slice(1).join(' ') || 'Egen boks',
    flavor: 'Egen registrering',
    accent: '#5b6470',
    white: true,
    strength: 3,
  };
}
