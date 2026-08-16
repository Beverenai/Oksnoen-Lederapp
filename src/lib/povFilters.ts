/**
 * POV-filtre – hvert filter har en CSS-filterstreng (brukes i søkeren og på
 * canvas der `ctx.filter` finnes), pluss en tallbasert beskrivelse som brukes
 * til å regne looken manuelt piksel for piksel. Safari på iPhone støtter ikke
 * `ctx.filter`, så uten fallbacken ble bildene lagret helt uten filter.
 */
export type PovFilterId = 'fxn' | 'fqs';

export type PovGrade = {
  /** 1 = uendret */
  saturate: number;
  contrast: number;
  brightness: number;
  /** grader */
  hueRotate: number;
  /** 0–1, mengde korn */
  grain: number;
};

export type PovFilter = {
  id: PovFilterId;
  label: string;
  /** CSS/canvas filter-streng */
  css: string;
  /** Tallverdier for manuell rendering */
  grade: PovGrade;
  /** Fargelegg bildet litt */
  tint?: { color: string; mode: GlobalCompositeOperation };
  /** 0–1, hvor mørk vignetten er */
  vignette: number;
};

export const POV_FILTERS: PovFilter[] = [
  {
    id: 'fxn',
    label: 'FXN',
    css: 'saturate(1.22) contrast(1.08) brightness(1.02) hue-rotate(-6deg)',
    grade: { saturate: 1.22, contrast: 1.08, brightness: 1.02, hueRotate: -6, grain: 0.05 },
    tint: { color: 'rgba(120, 200, 255, 0.1)', mode: 'soft-light' },
    vignette: 0.2,
  },
  {
    id: 'fqs',
    label: 'FQS',
    css: 'saturate(1.18) contrast(1.14) brightness(1.04) hue-rotate(4deg)',
    grade: { saturate: 1.18, contrast: 1.14, brightness: 1.04, hueRotate: 4, grain: 0.07 },
    tint: { color: 'rgba(160, 255, 140, 0.11)', mode: 'soft-light' },
    vignette: 0.24,
  },
];

export function povFilterOf(id: PovFilterId | string | null | undefined): PovFilter {
  return POV_FILTERS.find((f) => f.id === id) ?? POV_FILTERS[0];
}

/** Støtter denne nettleseren `ctx.filter` på canvas? (Safari gjør det ikke.) */
export function canvasFilterSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.filter = 'saturate(2)';
    return ctx.filter !== 'none' && ctx.filter !== '';
  } catch {
    return false;
  }
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** 3x3-matrise for hue-rotasjon (samme formel som CSS hue-rotate). */
function hueMatrix(deg: number): number[] {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

/**
 * Legger looken direkte på pikslene. Brukes når `ctx.filter` mangler, slik at
 * iPhone-bilder får samme resultat som det du ser i søkeren.
 */
export function applyGradeToImageData(image: ImageData, grade: PovGrade): void {
  const d = image.data;
  const { saturate, contrast, brightness, hueRotate, grain } = grade;
  const m = hueRotate ? hueMatrix(hueRotate) : null;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    if (brightness !== 1) {
      r *= brightness;
      g *= brightness;
      b *= brightness;
    }
    if (contrast !== 1) {
      r = (r - 127.5) * contrast + 127.5;
      g = (g - 127.5) * contrast + 127.5;
      b = (b - 127.5) * contrast + 127.5;
    }
    if (saturate !== 1) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * saturate;
      g = lum + (g - lum) * saturate;
      b = lum + (b - lum) * saturate;
    }
    if (m) {
      const nr = m[0] * r + m[1] * g + m[2] * b;
      const ng = m[3] * r + m[4] * g + m[5] * b;
      const nb = m[6] * r + m[7] * g + m[8] * b;
      r = nr;
      g = ng;
      b = nb;
    }
    if (grain > 0) {
      const n = (Math.random() - 0.5) * grain * 90;
      r += n;
      g += n;
      b += n;
    }

    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
}
