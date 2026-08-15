import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, SwitchCamera, X, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hapticImpact, hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import { POV_FILTERS, povFilterOf, type PovFilter, type PovFilterId } from '@/lib/povFilters';

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
const MAX_LONG_SIDE = 2600;

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

/** Draws a source frame at full resolution with a clean, bright grade + date stamp. */
async function developFrame(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  mirrored: boolean,
  look: PovFilter,
): Promise<Blob> {
  const vw = sw || 1440;
  const vh = sh || 1920;

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
  try {
    ctx.filter = look.css;
  } catch {
    /* older engines just get the raw frame */
  }
  if (mirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, w, h);
  ctx.restore();

  if (look.tint) {
    ctx.globalCompositeOperation = look.tint.mode;
    ctx.fillStyle = look.tint.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.55,
    w / 2, h / 2, Math.max(w, h) * 0.78,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${look.vignette})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  await loadStampFont();
  const d = new Date();
  const text = `${String(d.getDate()).padStart(2, '0')} ${MONTHS_NO[d.getMonth()]} ${d.getFullYear()}`;
  const size = Math.round(Math.min(w, h) * 0.03);
  ctx.font = `${size}px PovStamp, "Courier New", monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(255, 106, 0, 0.85)';
  ctx.shadowBlur = size * 0.55;
  ctx.fillStyle = '#ff8a1f';
  const margin = Math.round(Math.min(w, h) * 0.05);
  ctx.fillText(text, w - margin, h - margin);
  ctx.fillText(text, w - margin, h - margin); // second pass for the glowing burn-in
  ctx.shadowBlur = 0;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Klarte ikke lagre bildet'))),
      'image/jpeg',
      0.95,
    );
  });
}

export function DisposableCamera({ shotsLeft, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const imageCaptureRef = useRef<any>(null);
  const lastTapRef = useRef(0);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [winding, setWinding] = useState(false);
  const [shutterBlink, setShutterBlink] = useState(false);
  const [justShot, setJustShot] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [taken, setTaken] = useState(0);
  const [filterId, setFilterId] = useState<PovFilterId>(() => {
    const saved = localStorage.getItem('pov-filter');
    return povFilterOf(saved).id;
  });
  const look = povFilterOf(filterId);
  const [hasTorch, setHasTorch] = useState(false);
  const [canSwitch, setCanSwitch] = useState(true);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);

  const left = Math.max(shotsLeft - taken, 0);
  const empty = left <= 0;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    imageCaptureRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setReady(false);
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Nettleseren støtter ikke kamera.');
      return;
    }
    const base = {
      width: { ideal: 2160 },
      height: { ideal: 3840 },
      frameRate: { ideal: 30 },
    };
    // Try the exact lens first, then progressively looser constraints.
    const attempts: MediaStreamConstraints[] = [
      { video: { ...base, facingMode: { exact: facing } }, audio: false },
      { video: { ...base, facingMode: facing }, audio: false },
      { video: { facingMode: facing }, audio: false },
      { video: true, audio: false },
    ];
    let stream: MediaStream | null = null;
    let lastErr: any = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e: any) {
        lastErr = e;
        if (e?.name === 'NotAllowedError') break;
      }
    }
    if (!stream) {
      setError(
        lastErr?.name === 'NotAllowedError'
          ? 'Appen fikk ikke tilgang til kameraet. Tillat kamera i innstillingene.'
          : 'Fant ikke noe kamera på denne enheten.',
      );
      return;
    }

    const track = stream.getVideoTracks()[0];
    const caps: any = track?.getCapabilities?.();
    if (caps?.width?.max && caps?.height?.max) {
      await track
        .applyConstraints({
          width: { ideal: Math.min(caps.width.max, 2160) },
          height: { ideal: Math.min(caps.height.max, 3840) },
        })
        .catch(() => {});
    }
    trackRef.current = track ?? null;
    // Full-resolution stills where the browser supports it (Android/Chrome).
    try {
      const IC = (window as any).ImageCapture;
      imageCaptureRef.current = IC && track ? new IC(track) : null;
    } catch {
      imageCaptureRef.current = null;
    }
    setHasTorch(!!caps?.torch);
    const zoomCap = caps?.zoom;
    setZoomRange(
      zoomCap?.max && zoomCap.max > (zoomCap.min ?? 1)
        ? { min: zoomCap.min ?? 1, max: Math.min(zoomCap.max, 6) }
        : null,
    );
    setZoom(1);
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
    setReady(true);
  }, [facing, stopStream]);

  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  // iOS pauser strømmen når appen går i bakgrunnen — start den igjen.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const live = streamRef.current?.getVideoTracks()[0]?.readyState === 'live';
      if (!live) startStream();
      else videoRef.current?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [startStream]);

  // Er det i det hele tatt to kameraer her?
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((list) => setCanSwitch(list.filter((d) => d.kind === 'videoinput').length > 1))
      .catch(() => setCanSwitch(true));
  }, [ready]);

  const flip = useCallback(() => {
    hapticImpact('medium');
    setFacing((f) => (f === 'user' ? 'environment' : 'user'));
  }, []);

  /** Tapp i søkeren for å fokusere der. */
  const focusAt = useCallback(async (clientX: number, clientY: number, rect: DOMRect) => {
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    setFocusPoint({ x: x * 100, y: y * 100 });
    setTimeout(() => setFocusPoint(null), 900);
    hapticImpact('light');
    const track = trackRef.current;
    const caps: any = track?.getCapabilities?.();
    if (!track || !caps) return;
    const constraints: any = {};
    if (caps.focusMode?.includes?.('single-shot')) constraints.focusMode = 'single-shot';
    else if (caps.focusMode?.includes?.('continuous')) constraints.focusMode = 'continuous';
    if (caps.pointsOfInterest) constraints.pointsOfInterest = [{ x, y }];
    if (Object.keys(constraints).length === 0) return;
    await track.applyConstraints({ advanced: [constraints] } as any).catch(() => {});
  }, []);

  const applyZoom = useCallback(
    async (value: number) => {
      if (!zoomRange) return;
      const v = Math.min(Math.max(value, zoomRange.min), zoomRange.max);
      setZoom(v);
      await trackRef.current
        ?.applyConstraints({ advanced: [{ zoom: v } as any] } as any)
        .catch(() => {});
    },
    [zoomRange],
  );

  const shoot = async () => {
    if (!videoRef.current || !ready || winding || empty) return;
    hapticImpact('heavy');
    const track = trackRef.current;
    const useTorch = flashOn && hasTorch && facing === 'environment';
    if (useTorch) {
      await track?.applyConstraints({ advanced: [{ torch: true } as any] } as any).catch(() => {});
      await new Promise((r) => setTimeout(r, 160));
    } else if (flashOn) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 130);
    }
    setShutterBlink(true);
    setTimeout(() => setShutterBlink(false), 160);
    setWinding(true);
    try {
      let blob: Blob;
      const ic = imageCaptureRef.current;
      let bitmap: ImageBitmap | null = null;
      if (ic?.takePhoto) {
        try {
          const photo: Blob = await ic.takePhoto();
          bitmap = await createImageBitmap(photo);
        } catch {
          bitmap = null;
        }
      }
      if (bitmap) {
        blob = await developFrame(bitmap, bitmap.width, bitmap.height, facing === 'user', look);
        bitmap.close?.();
      } else {
        const v = videoRef.current;
        blob = await developFrame(v, v.videoWidth, v.videoHeight, facing === 'user', look);
      }

      // Opplasting skjer i bakgrunnen — du kan ta neste bilde med en gang.
      setTaken((t) => t + 1);
      setUploading((n) => n + 1);
      Promise.resolve(onCapture(blob))
        .catch(() => {
          setTaken((t) => Math.max(t - 1, 0));
          hapticError();
        })
        .finally(() => setUploading((n) => Math.max(n - 1, 0)));

      hapticSuccess();
      setJustShot(true);
      setTimeout(() => setJustShot(false), 1100);
    } catch {
      hapticError();
    } finally {
      if (useTorch) {
        await track?.applyConstraints({ advanced: [{ torch: false } as any] } as any).catch(() => {});
      }
      setTimeout(() => setWinding(false), 320);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] select-none overflow-hidden bg-black text-white">
      {/* Fullskjerm søker */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn(
          'absolute inset-0 h-full w-full object-cover',
          facing === 'user' && 'scale-x-[-1]',
        )}
        style={{ filter: look.css }}
      />

      {/* Tapp-flate: tapp = fokus, dobbelttapp = snu, klyp = zoom */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const now = Date.now();
          if (now - lastTapRef.current < 280) {
            lastTapRef.current = 0;
            if (canSwitch) flip();
            return;
          }
          lastTapRef.current = now;
          focusAt(e.clientX, e.clientY, rect);
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const [a, b] = [e.touches[0], e.touches[1]];
            pinchRef.current = {
              dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
              zoom,
            };
          }
        }}
        onTouchMove={(e) => {
          const start = pinchRef.current;
          if (e.touches.length !== 2 || !start) return;
          const [a, b] = [e.touches[0], e.touches[1]];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          applyZoom(start.zoom * (dist / start.dist));
        }}
        onTouchEnd={() => {
          pinchRef.current = null;
        }}
      />

      {/* Vignett + rutenett for engangskamera-følelsen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
      <div className="pointer-events-none absolute inset-6 border border-white/15" />

      {/* Blits */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-[80] bg-white transition-opacity duration-100',
          flashing ? 'opacity-95' : 'opacity-0',
        )}
      />
      {/* Lukker-blink */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-[79] bg-black transition-opacity duration-150',
          shutterBlink ? 'opacity-100' : 'opacity-0',
        )}
      />

      {focusPoint && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-50 fade-in rounded-xl border-2 border-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.5)]"
          style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
        />
      )}

      {/* Bekreftelse: bildet er tatt */}
      {justShot && (
        <div className="pointer-events-none absolute inset-0 z-[82] flex items-center justify-center px-8">
          <div className="animate-in zoom-in-50 fade-in flex flex-col items-center gap-3 rounded-3xl border border-amber-300/40 bg-black/70 px-8 py-6 text-center shadow-2xl backdrop-blur-md duration-150">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-300 text-neutral-900 shadow-[0_0_40px_rgba(252,211,77,0.55)]">
              <Check className="h-8 w-8" strokeWidth={3} />
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-amber-300/70" />
            </span>
            <div>
              <p className="font-heading text-base font-semibold text-white">Bilde tatt!</p>
              <p className="font-mono text-xs text-amber-300">
                {String(left).padStart(2, '0')} bilder igjen
              </p>
            </div>
          </div>
        </div>
      )}

      {(error || !ready) && (
        <div className="absolute inset-0 z-[78] flex flex-col items-center justify-center gap-3 bg-black/85 px-8 text-center">
          <p className="text-sm text-white/70">{error ?? 'Starter kamera…'}</p>
          {error && (
            <Button size="sm" variant="secondary" onClick={startStream}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Prøv igjen
            </Button>
          )}
        </div>
      )}

      {/* Toppmeny */}
      <div
        className="absolute inset-x-0 top-0 z-[76] flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-black/40 p-2 backdrop-blur active:scale-95"
          aria-label="Lukk kamera"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="rounded-full bg-black/40 px-4 py-1.5 text-center backdrop-blur">
          <div className="text-[9px] uppercase tracking-[0.25em] text-white/50">Øksnøen POV</div>
          <div className="font-mono text-sm text-amber-300">
            {String(left).padStart(2, '0')} igjen
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFlashOn((f) => !f)}
          className={cn(
            'rounded-full p-2 backdrop-blur active:scale-95',
            flashOn ? 'bg-amber-300 text-neutral-900' : 'bg-black/40 text-white',
          )}
          aria-label="Blits"
        >
          {flashOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
        </button>
      </div>

      {/* Bunnmeny */}
      <div
        className="absolute inset-x-0 bottom-0 z-[76] px-6"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {zoomRange && (
          <div className="mx-auto mb-4 flex max-w-xs items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
            <span className="font-mono text-[10px] text-white/50">
              {zoomRange.min.toFixed(1)}x
            </span>
            <input
              type="range"
              min={zoomRange.min}
              max={zoomRange.max}
              step={0.1}
              value={zoom}
              onChange={(e) => applyZoom(parseFloat(e.target.value))}
              aria-label="Zoom"
              className="h-1 flex-1 accent-amber-300"
            />
            <span className="font-mono text-[10px] text-amber-300">{zoom.toFixed(1)}x</span>
          </div>
        )}

        {/* Filtervelger */}
        <div className="-mx-6 mb-4 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2">
            {POV_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setFilterId(f.id);
                  try {
                    localStorage.setItem('pov-filter', f.id);
                  } catch {
                    /* ignorer */
                  }
                }}
                aria-pressed={filterId === f.id}
                className={cn(
                  'whitespace-nowrap rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider backdrop-blur transition-all active:scale-95',
                  filterId === f.id
                    ? 'bg-amber-300 text-neutral-900'
                    : 'bg-black/40 text-white/70',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="w-14 text-[10px] leading-tight text-white/50">
            {uploading > 0 ? `Laster opp ${uploading}…` : 'Tapp for fokus'}
          </div>

          <button
            type="button"
            onClick={shoot}
            disabled={!ready || empty || winding}
            aria-label="Ta bilde"
            className={cn(
              'relative flex h-[84px] w-[84px] items-center justify-center rounded-full border-[5px] border-white/80 transition-transform active:scale-90',
              (!ready || empty || winding) && 'opacity-40',
            )}
          >
            <span className="h-[64px] w-[64px] rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.35)]" />
          </button>

          <button
            type="button"
            onClick={flip}
            disabled={!canSwitch}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full bg-black/40 backdrop-blur active:scale-95',
              !canSwitch && 'opacity-40',
            )}
            aria-label="Bytt mellom front- og bakkamera"
          >
            <SwitchCamera className="h-6 w-6" />
          </button>
        </div>

        {empty && (
          <p className="mt-3 text-center font-mono text-sm text-amber-300">FILMEN ER FULL</p>
        )}
      </div>
    </div>
  );
}
