/**
 * POV-filtre – hvert filter har en CSS-filterstreng (brukes både i søkeren og
 * på canvas ved lagring), pluss valgfri fargetone og vignett-styrke.
 */
export type PovFilterId = 'fxn' | 'fqs';

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
    id: 'fxn',
    label: 'FXN',
    css: 'saturate(1.22) contrast(1.08) brightness(1.02) hue-rotate(-6deg)',
    tint: { color: 'rgba(120, 200, 255, 0.1)', mode: 'soft-light' },
    vignette: 0.2,
  },
  {
    id: 'fqs',
    label: 'FQS',
    css: 'saturate(1.18) contrast(1.14) brightness(1.04) hue-rotate(4deg)',
    tint: { color: 'rgba(160, 255, 140, 0.11)', mode: 'soft-light' },
    vignette: 0.24,
  },
];

export function povFilterOf(id: PovFilterId | string | null | undefined): PovFilter {
  return POV_FILTERS.find((f) => f.id === id) ?? POV_FILTERS[0];
}
