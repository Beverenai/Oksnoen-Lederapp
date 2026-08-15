/**
 * POV-filtre – hvert filter har en CSS-filterstreng (brukes både i søkeren og
 * på canvas ved lagring), pluss valgfri fargetone og vignett-styrke.
 */
export type PovFilterId =
  | 'original'
  | 'retro'
  | 'sommer'
  | 'kveld'
  | 'bw'
  | 'sepia'
  | 'flash'
  | 'kald';

export type PovFilter = {
  id: PovFilterId;
  label: string;
  /** CSS/canvas filter-streng */
  css: string;
  /** Fargelegg toppen av bildet litt */
  tint?: { color: string; mode: GlobalCompositeOperation };
  /** 0–1, hvor mørk vignetten er */
  vignette: number;
};

export const POV_FILTERS: PovFilter[] = [
  {
    id: 'original',
    label: 'Original',
    css: 'saturate(1.06) contrast(1.03)',
    tint: { color: 'rgba(255, 200, 150, 0.06)', mode: 'soft-light' },
    vignette: 0.12,
  },
  {
    id: 'retro',
    label: 'Retro',
    css: 'saturate(0.9) contrast(1.12) brightness(1.04) sepia(0.18)',
    tint: { color: 'rgba(255, 170, 90, 0.12)', mode: 'soft-light' },
    vignette: 0.28,
  },
  {
    id: 'sommer',
    label: 'Sommer',
    css: 'saturate(1.35) contrast(1.06) brightness(1.06)',
    tint: { color: 'rgba(255, 214, 120, 0.1)', mode: 'overlay' },
    vignette: 0.08,
  },
  {
    id: 'kveld',
    label: 'Kveld',
    css: 'saturate(1.1) contrast(1.18) brightness(0.92)',
    tint: { color: 'rgba(60, 80, 200, 0.14)', mode: 'soft-light' },
    vignette: 0.34,
  },
  {
    id: 'bw',
    label: 'Svart/hvitt',
    css: 'grayscale(1) contrast(1.2) brightness(1.03)',
    vignette: 0.22,
  },
  {
    id: 'sepia',
    label: 'Sepia',
    css: 'sepia(0.7) saturate(1.1) contrast(1.08)',
    tint: { color: 'rgba(180, 120, 60, 0.1)', mode: 'soft-light' },
    vignette: 0.26,
  },
  {
    id: 'flash',
    label: 'Blits 98',
    css: 'brightness(1.16) contrast(1.22) saturate(0.95)',
    tint: { color: 'rgba(255, 255, 255, 0.1)', mode: 'soft-light' },
    vignette: 0.4,
  },
  {
    id: 'kald',
    label: 'Kald',
    css: 'saturate(0.95) contrast(1.1) hue-rotate(-8deg)',
    tint: { color: 'rgba(120, 200, 255, 0.12)', mode: 'soft-light' },
    vignette: 0.18,
  },
];

export function povFilterOf(id: PovFilterId | string | null | undefined): PovFilter {
  return POV_FILTERS.find((f) => f.id === id) ?? POV_FILTERS[0];
}
