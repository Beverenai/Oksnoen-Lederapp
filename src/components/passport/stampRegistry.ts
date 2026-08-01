/**
 * Registry for custom stamp artwork per year + period.
 *
 * Key format: `"{year}-{periodCode}"`, e.g. `"2019-4+"`.
 * Drop an image (or an asset pointer url) in here and the passport will render
 * it instead of the generated SVG stamp. Anything not listed falls back to the
 * built-in engraved stamp.
 *
 * Example once artwork arrives:
 *   import stamp2019p3 from '@/assets/stamps/2019-3.png';
 *   export const STAMP_ARTWORK = { '2019-3': stamp2019p3 };
 */
export const STAMP_ARTWORK: Record<string, string> = {};

/** Optional per-year artwork used for every period that year. */
export const STAMP_ARTWORK_BY_YEAR: Record<string, string> = {};

export function stampKey(year: number | string, periodCode: string): string {
  return `${year}-${periodCode}`;
}

export function getStampArtwork(
  year: number | string,
  periodCode: string,
): string | null {
  return (
    STAMP_ARTWORK[stampKey(year, periodCode)] ??
    STAMP_ARTWORK_BY_YEAR[String(year)] ??
    null
  );
}