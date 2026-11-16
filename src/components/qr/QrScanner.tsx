import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Flashlight, FlashlightOff, Keyboard, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { parseWristbandCode } from '@/lib/wristband';

interface QrScannerProps {
  /** Kalles med båndnummeret hver gang et Oksnøen-bånd leses. */
  onCode: (code: string) => void;
  /** Kalles når en annen QR-kode leses. */
  onInvalid?: (raw: string) => void;
  /** Pause lesingen uten å slå av kameraet (f.eks. mens man velger deltaker). */
  paused?: boolean;
  /** Fyll hele forelderen (fullskjerm) i stedet for en avrundet rute. */
  fill?: boolean;
  className?: string;
}

// Samme kode gir ikke nytt treff før det har gått så lang tid.
const REPEAT_MS = 2000;
const SCAN_INTERVAL_MS = 90;
const MAX_FRAME = 720;

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function createNativeDetector(): Detector | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).BarcodeDetector;
    if (!Ctor) return null;
    return new Ctor({ formats: ['qr_code'] }) as Detector;
  } catch {
    return null;
  }
}

/**
 * Kontinuerlig QR-skanner. All skanning i appen går gjennom denne komponenten,
 * slik at den kan byttes til en ren iOS-skanner senere uten å endre sidene.
 */
export function QrScanner({ onCode, onInvalid, paused = false, fill = false, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const lastRef = useRef<{ raw: string; at: number }>({ raw: '', at: 0 });
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const onInvalidRef = useRef(onInvalid);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  pausedRef.current = paused;
  onCodeRef.current = onCode;
  onInvalidRef.current = onInvalid;

  const handleRaw = useCallback((raw: string) => {
    const now = Date.now();
    if (raw === lastRef.current.raw && now - lastRef.current.at < REPEAT_MS) return;
    lastRef.current = { raw, at: now };
    const code = parseWristbandCode(raw);
    if (code) onCodeRef.current(code);
    else onInvalidRef.current?.(raw);
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
    setTorchOn(false);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Kameraet er ikke tilgjengelig her. Tast nummeret i stedet.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      const track = stream.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (track?.getCapabilities?.() ?? {}) as any;
      setTorchAvailable(!!caps.torch);
      setError(null);
      setReady(true);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Appen har ikke tilgang til kameraet. Gi tilgang i innstillingene, eller tast nummeret.'
          : 'Fikk ikke startet kameraet. Tast nummeret i stedet.',
      );
    }
  }, []);

  // Start og stopp kameraet med siden, og når appen går i bakgrunnen.
  useEffect(() => {
    detectorRef.current = createNativeDetector();
    start();
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [start, stop]);

  // Leseløkken.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && !pausedRef.current && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const detector = detectorRef.current;
          if (detector) {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) handleRaw(found[0].rawValue);
          } else {
            const scale = Math.min(1, MAX_FRAME / Math.max(video.videoWidth, video.videoHeight));
            const w = Math.round(video.videoWidth * scale);
            const h = Math.round(video.videoHeight * scale);
            const canvas = (canvasRef.current ??= document.createElement('canvas'));
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const image = ctx.getImageData(0, 0, w, h);
              const result = jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' });
              if (result?.data) handleRaw(result.data);
            }
          }
        } catch {
          // Faller den innebygde leseren ut, bruker vi jsQR videre.
          detectorRef.current = null;
        }
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, handleRaw]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch {
      setTorchAvailable(false);
    }
  };

  const submitManual = () => {
    const code = parseWristbandCode(manualValue);
    if (!code) return;
    lastRef.current = { raw: '', at: 0 };
    onCodeRef.current(code);
    setManualValue('');
    setManualOpen(false);
  };

  return (
    <div className={cn(fill ? 'absolute inset-0' : 'space-y-2', className)}>
      <div className={cn('relative overflow-hidden bg-black', fill ? 'h-full w-full' : 'rounded-3xl aspect-[4/3] sm:aspect-video')}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn('h-full w-full object-cover', (!ready || error) && 'opacity-0')}
        />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                fill ? 'w-[62%] max-w-xs' : 'h-[58%]',
                'aspect-square rounded-3xl border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)] transition-opacity',
                paused && 'opacity-40',
              )}
            />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff className="h-8 w-8 opacity-80" />
            <p className="text-sm">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => start()}>
              Prøv igjen
            </Button>
          </div>
        )}
        <div
          className={cn(
            'absolute right-3 flex gap-2',
            fill ? 'top-[calc(env(safe-area-inset-top,0px)+4.75rem)] flex-col' : 'bottom-3',
          )}
        >
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? 'Slå av lommelykt' : 'Slå på lommelykt'}
              className="rounded-full bg-black/55 p-3 text-white backdrop-blur"
            >
              {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            aria-label="Tast nummer"
            className="rounded-full bg-black/55 p-3 text-white backdrop-blur"
          >
            <Keyboard className="h-5 w-5" />
          </button>
        </div>
      </div>

      {manualOpen && (
        <form
          className={cn('flex gap-2', fill && 'absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-3xl bg-background p-3 shadow-2xl')}
          onSubmit={(e) => {
            e.preventDefault();
            submitManual();
          }}
        >
          <Input
            id="qr-manual-code"
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="Nummeret på båndet"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value.replace(/\D/g, ''))}
            className="h-12 rounded-2xl text-lg tabular-nums"
          />
          <Button type="submit" className="h-12 rounded-2xl px-5" disabled={!parseWristbandCode(manualValue)}>
            Bruk
          </Button>
        </form>
      )}
    </div>
  );
}
