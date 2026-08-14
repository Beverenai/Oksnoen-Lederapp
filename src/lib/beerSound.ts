/**
 * «Psshhh» — en pils som åpnes, laget i WebAudio slik at vi slipper lydfiler.
 * Kort trykkbølge (kork/kapsel) + hvit støy som fizzer ut.
 */
export async function playBeerCrack() {
  try {
    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;

    // 1) Selve «kna-k»-et når kapselen løsner
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

    // 2) Fizz — filtrert hvit støy som faller av
    const dur = 1.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

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

    window.setTimeout(() => ctx.close().catch(() => {}), (dur + 0.3) * 1000);
  } catch {
    /* lyd er bonus – aldri kritisk */
  }
}
