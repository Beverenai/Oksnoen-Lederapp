import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera, X, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hapticImpact, hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

type Props = {
  shotsLeft: number;
  busy?: boolean;
  onCapture: (blob: Blob) => Promise<void> | void;
  onClose: () => void;
};

const MONTHS_NO = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN',
  'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES',
];

/** Longest side of the saved photo — keeps full sensor detail without huge files. */
const MAX_LONG_SIDE = 2400;

let stampFontLoaded: Promise<void> | null = null;

/** Pixel stamp font, loaded once and ignored if it fails. */
function loadStampFont(): Promise<void> {
  if (stampFontLoaded) return stampFontLoaded;
  stampFontLoaded = (async () => {
    try {
      const face = new FontFace(
        'PovStamp',
        "url(https://fonts.gstatic.com/s/silkscreen/v3/m8JXjfVPf62XiF7kO-i9ULQ4.woff2) format('woff2')",
      );
      const loaded = await face.load();
      (document.fonts as FontFaceSet).add(loaded);
    } catch {
      /* fall back to monospace */
    }
  })();
  return stampFontLoaded;
}

/**
 * Draws the live frame at full sensor resolution with a clean, bright grade:
 * light contrast + saturation lift, a whisper of grain and a soft vignette.
 */
async function developFrame(
  video: HTMLVideoElement,
  mirrored: boolean,
  stamp: boolean,
): Promise<Blob> {
  const vw = video.videoWidth || 1440;
  const vh = video.videoHeight || 1920;

  // Keep the camera's own aspect ratio — no crop, no lost pixels.
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  // Clean grade: crisp and bright, not a heavy vintage filter.
  try {
    ctx.filter = 'saturate(1.1) contrast(1.06) brightness(1.03)';
  } catch {
    /* older engines just get the raw frame */
  }
  if (mirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  // Barely-there warm highlight so skin tones glow like the reference shot.
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(255, 196, 140, 0.10)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // Soft vignette, just enough to hold the eye in the frame.
  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.45,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Fine grain (very subtle, scaled to the frame so it never looks noisy).
  const grainCount = Math.round((w * h) / 900);
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < grainCount; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  ctx.globalAlpha = 1;

  if (stamp) {
    await loadStampFont();
    const d = new Date();
    const text = `POV CAMERA • ${String(d.getDate()).padStart(2, '0')} ${MONTHS_NO[d.getMonth()]} ${d.getFullYear()}`;
    const size = Math.round(Math.min(w, h) * 0.032);
    ctx.font = `${size}px PovStamp, "Courier New", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(255, 106, 0, 0.85)';
    ctx.shadowBlur = size * 0.55;
    ctx.fillStyle = '#ff8a1f';
    const margin = Math.round(Math.min(w, h) * 0.055);
    ctx.fillText(text, margin, h - margin);
    ctx.fillText(text, margin, h - margin); // second pass for the glowing burn-in
    ctx.shadowBlur = 0;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Klarte ikke lagre bildet'))),
      'image/jpeg',
      0.94,
    );
  });
}

export function DisposableCamera({ shotsLeft, busy, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(true);
  const [stamp, setStamp] = useState(true);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [winding, setWinding] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setReady(false);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          // Ask for the sharpest feed the device can give us.
          width: { ideal: 2160 },
          height: { ideal: 3840 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      // Some devices only expose their full resolution after applying constraints.
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.();
      if (caps?.width?.max && caps?.height?.max) {
        await track
          .applyConstraints({
            width: { ideal: Math.min(caps.width.max, 2160) },
            height: { ideal: Math.min(caps.height.max, 3840) },
          })
          .catch(() => {});
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Appen fikk ikke tilgang til kameraet. Tillat kamera i innstillingene.'
          : 'Fant ikke noe kamera på denne enheten.',
      );
    }
  }, [facing, stopStream]);

  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  const shoot = async () => {
    if (!videoRef.current || !ready || busy || winding || shotsLeft <= 0) return;
    hapticImpact('heavy');
    if (flashOn) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 140);
    }
    setWinding(true);
    try {
      const blob = await developFrame(videoRef.current, facing === 'user', stamp);
      await onCapture(blob);
      hapticSuccess();
    } catch {
      hapticError();
    } finally {
      // Fake film-winding delay — you can't machine-gun a disposable camera.
      setTimeout(() => setWinding(false), 700);
    }
  };

  const empty = shotsLeft <= 0;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-neutral-950 text-white">
      {/* Flash */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-[80] bg-white transition-opacity duration-100',
          flashing ? 'opacity-95' : 'opacity-0',
        )}
      />

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 active:scale-95"
          aria-label="Lukk kamera"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Øksnøen POV</div>
          <div className="font-mono text-sm text-amber-300">
            {String(Math.max(shotsLeft, 0)).padStart(2, '0')} bilder igjen
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          className="rounded-full bg-white/10 p-2 active:scale-95"
          aria-label="Bytt kamera"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      {/* Camera body */}
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-900 p-4 shadow-2xl">
          {/* Top plate */}
          <div className="mb-3 flex items-center justify-between">
            <div className="h-3 w-10 rounded-full bg-white/10" />
            <div className="h-6 w-6 rounded-full bg-amber-300/80 shadow-[0_0_16px_rgba(252,211,77,0.6)]" />
          </div>

          {/* Viewfinder */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                'h-full w-full object-cover',
                facing === 'user' && 'scale-x-[-1]',
                'saturate-[1.1] contrast-[1.06] brightness-[1.03]',
              )}
            />
            {/* Frame guides */}
            <div className="pointer-events-none absolute inset-3 border border-white/25" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
            {(error || !ready) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
                <p className="text-xs text-white/70">{error ?? 'Starter kamera…'}</p>
                {error && (
                  <Button size="sm" variant="secondary" onClick={startStream}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Prøv igjen
                  </Button>
                )}
              </div>
            )}
            {empty && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/85 px-6 text-center">
                <p className="font-mono text-sm text-amber-300">FILMEN ER FULL</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setFlashOn((f) => !f)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium',
                flashOn ? 'bg-amber-300/90 text-neutral-900' : 'bg-white/10 text-white/60',
              )}
            >
              {flashOn ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
              Blits
            </button>

            <button
              type="button"
              onClick={shoot}
              disabled={!ready || empty || busy || winding}
              aria-label="Ta bilde"
              className={cn(
                'relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/20 bg-gradient-to-b from-neutral-100 to-neutral-400 text-neutral-900 shadow-lg transition-transform active:scale-95',
                (!ready || empty || busy || winding) && 'opacity-40',
              )}
            >
              <Camera className="h-7 w-7" strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={() => setStamp((s) => !s)}
              className={cn(
                'rounded-full px-3 py-1.5 font-mono text-[11px]',
                stamp ? 'bg-amber-300/90 text-neutral-900' : 'bg-white/10 text-white/60',
              )}
            >
              Dato
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] leading-snug text-white/40">
            {winding
              ? 'Sveiver frem filmen…'
              : 'Ingen forhåndsvisning. Bildene utvikles når filmen er ferdig.'}
          </p>
        </div>
      </div>

      <div style={{ height: 'max(1rem, env(safe-area-inset-bottom))' }} />
    </div>
  );
}