/**
 * Lyder for slurker – øl, vin og drink. Alt lages i WebAudio slik at vi
 * slipper lydfiler (og de virker offline).
 */
import { playBeerCrack } from './beerSound';

export type DrinkType = 'beer' | 'wine' | 'drink';

export const DRINKS: Record<DrinkType, { label: string; emoji: string; noun: string }> = {
  beer: { label: 'Øl', emoji: '🍺', noun: 'pilsen' },
  wine: { label: 'Vin', emoji: '🍷', noun: 'vinen' },
  drink: { label: 'Drink', emoji: '🍸', noun: 'drinken' },
};

export function drinkOf(value: string | null | undefined): DrinkType {
  return value === 'wine' || value === 'drink' ? value : 'beer';
}

function ctxOrNull(): AudioContext | null {
  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
}

/** Kork som popper + vin som helles i glass. */
async function playWinePour() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;

  // «Pop» – korken ut av flasken
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

  // Helling – boblende støy med stigende tonehøyde (glasset fylles)
  const dur = 1.8;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const glug = 0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t);
    data[i] = (Math.random() * 2 - 1) * glug;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

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

  window.setTimeout(() => ctx.close().catch(() => {}), (dur + 0.3) * 1000);
}

/** Shaker med is + klirr i glasset. */
async function playCocktailShake() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;

  // Shaker: fire raske «rist» med isbiter
  for (let s = 0; s < 4; s++) {
    const at = now + s * 0.17;
    const dur = 0.14;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.value = 0.38;
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(at);
    src.stop(at + dur);
  }

  // Klirr – to lyse toner som ringer ut (glass mot glass)
  [1860, 2480].forEach((freq, i) => {
    const at = now + 0.72 + i * 0.08;
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

  window.setTimeout(() => ctx.close().catch(() => {}), 2200);
}

/** Spiller lyden som hører til drikketypen. */
export async function playDrinkSound(type: DrinkType) {
  try {
    if (type === 'wine') return await playWinePour();
    if (type === 'drink') return await playCocktailShake();
    return await playBeerCrack();
  } catch {
    /* lyd er bonus – aldri kritisk */
  }
}
