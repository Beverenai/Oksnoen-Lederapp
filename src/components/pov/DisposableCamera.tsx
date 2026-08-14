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

/** Renders the video frame with a disposable-camera look onto a canvas. */
function developFrame(
  video: HTMLVideoElement,
  mirrored: boolean,
  stamp: boolean,
): Promise<Blob> {
  const targetW = 1200;
  const targetH = 900; // 4:3
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // Cover-crop the video into 4:3
  const vw = video.videoWidth || targetW;
  const vh = video.videoHeight || targetH;
  const scale = Math.max(targetW / vw, targetH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (targetW - dw) / 2;
  const dy = (targetH - dh) / 2;

  ctx.save();
  if (mirrored) {
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, dx, dy, dw, dh);
  ctx.restore();

  // Warm film tone
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(255, 176, 92, 0.28)';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.globalCompositeOperation = 'source-over';

  // Vignette
  const grad = ctx.createRadialGradient(
    targetW / 2, targetH / 2, targetH * 0.25,
    targetW / 2, targetH / 2, targetH * 0.8,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, targetW, targetH);

  // Grain
  const grainCount = Math.round((targetW * targetH) / 90);
  ctx.globalAlpha = 0.055;
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * targetW;
    const y = Math.random() * targetH;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;

  // Date stamp
  if (stamp) {
    const d = new Date();
    const text = `${String(d.getDate()).padStart(2, '0')} ${String(d.getMonth() + 1).padStart(2, '0')} '${String(d.getFullYear()).slice(2)}`;
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(255,120,0,0.9)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff9d3d';
    ctx.fillText(text, targetW - 42, targetH - 44);
    ctx.shadowBlur = 0;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Klarte ikke lagre bildet'))),
      'image/jpeg',
      0.86,
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
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
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
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                'h-full w-full object-cover',
                facing === 'user' && 'scale-x-[-1]',
                'saturate-[0.9] contrast-[1.05] sepia-[0.12]',
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