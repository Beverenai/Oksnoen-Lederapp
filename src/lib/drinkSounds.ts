/**
 * Drikketyper for slurker – hver leder velger sin egen drikke, og alle
 * slurker de gir vises og høres som den drikken. Alle lyder lages i
 * WebAudio slik at vi slipper lydfiler (og de virker offline).
 */

export type DrinkType = 'beer' | 'wine' | 'drink';

export const DRINKS: Record<
  DrinkType,
  { label: string; emoji: string; noun: string; sound: string }
> = {
  beer: { label: 'Øl', emoji: '🍺', noun: 'pilsen', sound: 'sip-beer.caf' },
  wine: { label: 'Vin', emoji: '🍷', noun: 'vinen', sound: 'sip-wine.caf' },
  drink: { label: 'Sprit', emoji: '🥃', noun: 'spriten', sound: 'sip-drink.caf' },
};

export const DRINK_TYPES = Object.keys(DRINKS) as DrinkType[];

/** Gamle drikketyper fra databasen mappes til de tre som finnes nå. */
const LEGACY: Record<string, DrinkType> = {
  vodka: 'drink',
  shot: 'drink',
  champagne: 'wine',
};

export function drinkOf(value: string | null | undefined): DrinkType {
  const v = value ?? '';
  if ((DRINK_TYPES as string[]).includes(v)) return v as DrinkType;
  return LEGACY[v] ?? 'beer';
}

function newCtx(): AudioContext | null {
  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
}

function noiseBuffer(ctx: AudioContext, dur: number, shape?: (t: number) => number) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * (shape ? shape(t) : 1);
  }
  return buffer;
}

/** «Psshhh» – en pils som åpnes. */
async function beer(ctx: AudioContext) {
  const now = ctx.currentTime;

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'triangle';
  click.frequency.setValueAtTime(420, now);
  click.frequency.exponentialRampToValueAtTime(90, now + 0.09);
  clickGain.gain.setValueAtTime(0.5, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  click.connect(clickGain).connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.13);

  const dur = 1.5;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, dur);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(1200, now);
  bp.frequency.exponentialRampToValueAtTime(5200, now + 0.12);
  bp.frequency.exponentialRampToValueAtTime(2200, now + dur);

  const hiss = ctx.createGain();
  hiss.gain.setValueAtTime(0.0001, now);
  hiss.gain.exponentialRampToValueAtTime(0.42, now + 0.06);
  hiss.gain.exponentialRampToValueAtTime(0.06, now + 0.6);
  hiss.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  noise.connect(bp).connect(hiss).connect(ctx.destination);
  noise.start(now + 0.02);
  noise.stop(now + dur);
  return dur;
}

/** Kork som popper + vin som helles i glass. */
async function wine(ctx: AudioContext) {
  const now = ctx.currentTime;

  const pop = ctx.createOscillator();
  const popGain = ctx.createGain();
  pop.type = 'sine';
  pop.frequency.setValueAtTime(760, now);
  pop.frequency.exponentialRampToValueAtTime(140, now + 0.09);
  popGain.gain.setValueAtTime(0.55, now);
  popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  pop.connect(popGain).connect(ctx.destination);
  pop.start(now);
  pop.stop(now + 0.14);

  const dur = 1.8;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, dur, (t) => 0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t));

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(420, now + 0.15);
  bp.frequency.linearRampToValueAtTime(1400, now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  noise.connect(bp).connect(gain).connect(ctx.destination);
  noise.start(now + 0.15);
  noise.stop(now + dur);
  return dur;
}

/** Shaker med is + klirr i glasset. */
async function cocktail(ctx: AudioContext, shakes = 4) {
  const now = ctx.currentTime;

  for (let s = 0; s < shakes; s++) {
    const at = now + s * 0.17;
    const dur = 0.14;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, dur, (t) => {
      const env = 1 - t / dur;
      return env * env;
    });
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.value = 0.38;
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(at);
    src.stop(at + dur);
  }

  [1860, 2480].forEach((freq, i) => {
    const at = now + shakes * 0.17 + 0.04 + i * 0.08;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, at);
    g.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    osc.connect(g).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.95);
  });

  return shakes * 0.17 + 1.1;
}

/** Champagnekork + bobler + skål-klirr. */
async function champagne(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Kraftig kork
  const pop = ctx.createOscillator();
  const popGain = ctx.createGain();
  pop.type = 'triangle';
  pop.frequency.setValueAtTime(1100, now);
  pop.frequency.exponentialRampToValueAtTime(120, now + 0.07);
  popGain.gain.setValueAtTime(0.7, now);
  popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  pop.connect(popGain).connect(ctx.destination);
  pop.start(now);
  pop.stop(now + 0.11);

  // Bobler – lyse, korte knitringer
  const dur = 1.6;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, dur, () => (Math.random() > 0.86 ? 1 : 0.12));
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.26, now + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(hp).connect(g).connect(ctx.destination);
  noise.start(now + 0.1);
  noise.stop(now + dur);

  // Skål – to glass som møtes
  [2640, 3320].forEach((freq, i) => {
    const at = now + 0.75 + i * 0.06;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    og.gain.setValueAtTime(0.001, at);
    og.gain.exponentialRampToValueAtTime(0.28, at + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(og).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 1.15);
  });

  return dur + 0.4;
}

/** Kort «skål» – glass i bordet og en rask slurk. */
async function shot(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Glasset settes i bordet
  const thud = ctx.createOscillator();
  const tg = ctx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(230, now);
  thud.frequency.exponentialRampToValueAtTime(70, now + 0.12);
  tg.gain.setValueAtTime(0.6, now);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  thud.connect(tg).connect(ctx.destination);
  thud.start(now);
  thud.stop(now + 0.2);

  // Rask «gulp»
  const gulp = ctx.createOscillator();
  const gg = ctx.createGain();
  gulp.type = 'sine';
  gulp.frequency.setValueAtTime(140, now + 0.2);
  gulp.frequency.exponentialRampToValueAtTime(420, now + 0.34);
  gg.gain.setValueAtTime(0.0001, now + 0.2);
  gg.gain.exponentialRampToValueAtTime(0.32, now + 0.26);
  gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  gulp.connect(gg).connect(ctx.destination);
  gulp.start(now + 0.2);
  gulp.stop(now + 0.45);

  // Klirr til slutt
  const ring = ctx.createOscillator();
  const rg = ctx.createGain();
  ring.type = 'sine';
  ring.frequency.value = 2100;
  rg.gain.setValueAtTime(0.001, now + 0.5);
  rg.gain.exponentialRampToValueAtTime(0.22, now + 0.51);
  rg.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  ring.connect(rg).connect(ctx.destination);
  ring.start(now + 0.5);
  ring.stop(now + 1.15);

  return 1.3;
}

/** Ekte lydfiler (Pixabay) – se public/sounds/LICENSE.txt */
const FILES: Partial<Record<DrinkType, string>> = {
  beer: '/sounds/sip-beer.mp3',
  wine: '/sounds/sip-wine.mp3',
  drink: '/sounds/sip-drink.mp3',
};

const cache = new Map<string, HTMLAudioElement>();

function preload(src: string) {
  let el = cache.get(src);
  if (!el) {
    el = new Audio(src);
    el.preload = 'auto';
    cache.set(src, el);
  }
  return el;
}

/** Laster inn lydfilene i bakgrunnen slik at avspilling blir umiddelbar. */
export function preloadDrinkSounds() {
  if (typeof Audio === 'undefined') return;
  Object.values(FILES).forEach((src) => src && preload(src));
}

/** Prøver ekte lydfil – returnerer false hvis den ikke kan spilles. */
async function playFile(src: string): Promise<boolean> {
  if (typeof Audio === 'undefined') return false;
  try {
    // Klon slik at raske gjentatte avspillinger ikke avbryter hverandre.
    const node = preload(src).cloneNode(true) as HTMLAudioElement;
    node.volume = 1;
    await node.play();
    return true;
  } catch {
    return false;
  }
}

async function playSynth(t: DrinkType) {
  try {
    const ctx = newCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    let dur = 1.5;
    if (t === 'wine') dur = await wine(ctx);
    else if (t === 'drink') dur = await cocktail(ctx);
    else dur = await beer(ctx);
    window.setTimeout(() => ctx.close().catch(() => {}), (dur + 0.3) * 1000);
  } catch {
    /* lyd er bonus – aldri kritisk */
  }
}

/** Spiller lyden som hører til drikketypen. */
export async function playDrinkSound(type: DrinkType | string | null | undefined) {
  const t = drinkOf(typeof type === 'string' ? type : 'beer');
  const src = FILES[t];
  if (src && (await playFile(src))) return;
  await playSynth(t);
}
