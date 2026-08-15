/**
 * POV-filtre – hvert filter har en CSS-filterstreng (brukes både i søkeren og
 * på canvas ved lagring), pluss valgfri fargetone og vignett-styrke.
 */
export type PovFilterId = 'd3d' | 'nineties' | 'fxn';

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
    id: 'd3d',
    label: 'D3D',
    css: 'brightness(1.12) contrast(1.18) saturate(1.05)',
    tint: { color: 'rgba(255, 236, 200, 0.1)', mode: 'soft-light' },
    vignette: 0.36,
  },
  {
    id: 'nineties',
    label: '90s',
    css: 'saturate(0.92) contrast(1.14) brightness(1.05) sepia(0.16)',
    tint: { color: 'rgba(255, 170, 90, 0.12)', mode: 'soft-light' },
    vignette: 0.28,
  },
  {
    id: 'fxn',
    label: 'FXN',
    css: 'saturate(1.22) contrast(1.08) brightness(1.02) hue-rotate(-6deg)',
    tint: { color: 'rgba(120, 200, 255, 0.1)', mode: 'soft-light' },
    vignette: 0.2,
  },
];

export function povFilterOf(id: PovFilterId | string | null | undefined): PovFilter {
  return POV_FILTERS.find((f) => f.id === id) ?? POV_FILTERS[0];
}
