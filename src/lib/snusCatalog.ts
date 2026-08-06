export type SnusStrength = 1 | 2 | 3 | 4 | 5;

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
  format?: string;
}

export interface SnusBrandGroup {
  brand: string;
  products: SnusProduct[];
}

export const SNUS_CATALOG: SnusProduct[] = [
  // ---- General ----
  { id: 'general-white-portion', brand: 'General', variant: 'White Portion', flavor: 'Klassisk tobakk', accent: '#1f4e79', white: true, strength: 2 },
  { id: 'general-original-portion', brand: 'General', variant: 'Original Portion', flavor: 'Klassisk tobakk', accent: '#123a5c', white: false, strength: 2 },
  { id: 'general-mint-white', brand: 'General', variant: 'Mint White', flavor: 'Mint', accent: '#1f8a6d', white: true, strength: 2 },
  { id: 'general-extra-strong', brand: 'General', variant: 'Extra Strong White', flavor: 'Klassisk tobakk', accent: '#0b2740', white: true, strength: 4 },
  { id: 'general-g3', brand: 'General', variant: 'G.3 Slim', flavor: 'Bergamott & einer', accent: '#2f5f8f', white: true, strength: 3 },
  { id: 'general-snus-nordic-mint', brand: 'General', variant: 'Nordic Mint Slim', flavor: 'Mint', accent: '#0f7a6a', white: true, strength: 3 },

  // ---- Skruf ----
  { id: 'skruf-super-white-no53', brand: 'Skruf', variant: 'Super White No53', flavor: 'Fresh Mint', accent: '#1f7a4c', white: true, strength: 3 },
  { id: 'skruf-super-white-no54', brand: 'Skruf', variant: 'Super White No54', flavor: 'Fresh Mint Strong', accent: '#14603b', white: true, strength: 4 },
  { id: 'skruf-super-white-nordic', brand: 'Skruf', variant: 'Super White Nordic Nights', flavor: 'Lakris & mint', accent: '#2b2f6b', white: true, strength: 4 },
  { id: 'skruf-super-white-berry', brand: 'Skruf', variant: 'Super White Wild Berries', flavor: 'Skogsbær', accent: '#7b2450', white: true, strength: 3 },
  { id: 'skruf-slim-fresh', brand: 'Skruf', variant: 'Slim Fresh White', flavor: 'Mint & sitrus', accent: '#2f8f7d', white: true, strength: 2 },
  { id: 'skruf-original-portion', brand: 'Skruf', variant: 'Original Portion', flavor: 'Tobakk & bergamott', accent: '#123f2d', white: false, strength: 2 },

  // ---- The Lab ----
  { id: 'thelab-1', brand: 'The Lab', variant: 'No 1', flavor: 'Mint', accent: '#3f9ad6', white: true, strength: 1 },
  { id: 'thelab-2', brand: 'The Lab', variant: 'No 2', flavor: 'Mint & eukalyptus', accent: '#2f7fbd', white: true, strength: 2 },
  { id: 'thelab-3', brand: 'The Lab', variant: 'No 3', flavor: 'Kraftig mint', accent: '#1f5f9c', white: true, strength: 3 },
  { id: 'thelab-4', brand: 'The Lab', variant: 'No 4', flavor: 'Mint & lakris', accent: '#173f75', white: true, strength: 4 },
  { id: 'thelab-5', brand: 'The Lab', variant: 'No 5', flavor: 'Ekstra sterk mint', accent: '#10294f', white: true, strength: 5 },
  { id: 'thelab-6', brand: 'The Lab', variant: 'No 6', flavor: 'Ekstrem mint', accent: '#0a1a33', white: true, strength: 5 },

  // ---- Epok ----
  { id: 'epok-ice-cool', brand: 'Epok', variant: 'Ice Cool Slim', flavor: 'Kald mint', accent: '#3aa6c9', white: true, strength: 2 },
  { id: 'epok-dark-mint', brand: 'Epok', variant: 'Dark Mint Slim', flavor: 'Mint & lakris', accent: '#1d2733', white: true, strength: 3 },
  { id: 'epok-blueberry', brand: 'Epok', variant: 'Blueberry Slim', flavor: 'Blåbær', accent: '#3a4a9c', white: true, strength: 2 },
  { id: 'epok-lime', brand: 'Epok', variant: 'Lime Slim', flavor: 'Lime', accent: '#7fae2a', white: true, strength: 2 },
  { id: 'epok-strong-mint', brand: 'Epok', variant: 'Strong Mint', flavor: 'Sterk mint', accent: '#0e6b7a', white: true, strength: 4 },

  // ---- Siberia ----
  { id: 'siberia-red-white', brand: 'Siberia', variant: '-80 White Dry', flavor: 'Ekstrem mint', accent: '#b3261e', white: true, strength: 5 },
  { id: 'siberia-blue', brand: 'Siberia', variant: '-80 Blue Slim', flavor: 'Mint', accent: '#1b4fa0', white: true, strength: 4 },
  { id: 'siberia-brown', brand: 'Siberia', variant: '-80 Brown Portion', flavor: 'Mint & tobakk', accent: '#5b3a1e', white: false, strength: 5 },

  // ---- Loop ----
  { id: 'loop-mango', brand: 'Loop', variant: 'Mango Mist Slim', flavor: 'Mango', accent: '#e08b1f', white: true, strength: 3 },
  { id: 'loop-jalla', brand: 'Loop', variant: 'Jalla Jalla Slim', flavor: 'Sitrus & mint', accent: '#d0602a', white: true, strength: 3 },
  { id: 'loop-eucalyptus', brand: 'Loop', variant: 'Eucalyptus Frost', flavor: 'Eukalyptus', accent: '#2f9c8a', white: true, strength: 4 },
  { id: 'loop-lemon', brand: 'Loop', variant: 'Lemon Bloom', flavor: 'Sitron', accent: '#c9b32a', white: true, strength: 3 },

  // ---- Odens ----
  { id: 'odens-cold-extreme', brand: 'Odens', variant: 'Cold Extreme White Dry', flavor: 'Mint', accent: '#1e6fa8', white: true, strength: 5 },
  { id: 'odens-double-mint', brand: 'Odens', variant: 'Double Mint Extreme', flavor: 'Dobbel mint', accent: '#0f7a5a', white: true, strength: 5 },
  { id: 'odens-lakrits', brand: 'Odens', variant: 'Lakrits Extreme', flavor: 'Lakris', accent: '#22222a', white: false, strength: 5 },

  // ---- Lundgrens ----
  { id: 'lundgrens-skane', brand: 'Lundgrens', variant: 'Skåne White', flavor: 'Rabarbra & vanilje', accent: '#8a2f4b', white: true, strength: 2 },
  { id: 'lundgrens-jarva', brand: 'Lundgrens', variant: 'Järva White', flavor: 'Bær & mint', accent: '#3a6f2f', white: true, strength: 2 },

  // ---- Ettan ----
  { id: 'ettan-portion', brand: 'Ettan', variant: 'Original Portion', flavor: 'Klassisk tobakk', accent: '#8a6a2f', white: false, strength: 2 },
  { id: 'ettan-white', brand: 'Ettan', variant: 'White Portion', flavor: 'Klassisk tobakk', accent: '#a1802f', white: true, strength: 2 },
  { id: 'ettan-los', brand: 'Ettan', variant: 'Løs', flavor: 'Klassisk tobakk', accent: '#6f5324', white: false, strength: 2, format: 'Løssnus' },

  // ---- Knox ----
  { id: 'knox-white-large', brand: 'Knox', variant: 'White Large', flavor: 'Tobakk & mint', accent: '#2f5b8a', white: true, strength: 3 },
  { id: 'knox-blue-strong', brand: 'Knox', variant: 'Blue Strong White', flavor: 'Mint', accent: '#1b3f6b', white: true, strength: 4 },

  // ---- XR / XRANGE ----
  { id: 'xr-mint', brand: 'XR', variant: 'Mint Slim', flavor: 'Mint', accent: '#1f8a7a', white: true, strength: 3 },
  { id: 'xr-cool-mint', brand: 'XR', variant: 'Cool Mint Strong', flavor: 'Kald mint', accent: '#14636f', white: true, strength: 4 },
];

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
  const q = query.trim().toLowerCase();
  if (!q) return SNUS_CATALOG;
  return SNUS_CATALOG.filter((p) =>
    `${p.brand} ${p.variant} ${p.flavor}`.toLowerCase().includes(q)
  );
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
