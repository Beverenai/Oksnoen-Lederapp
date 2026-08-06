import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { SnusProduct } from '@/lib/snusCatalog';

interface SnusCan3DProps {
  product: SnusProduct;
  /** Diameter of the can in px */
  size?: number;
  interactive?: boolean;
  className?: string;
  /** Horizontal swipe callback (used to step between cans) */
  onSwipe?: (dir: 1 | -1) => void;
}

const SEGMENTS = 40;
const TILT = 62;
const STRENGTH_DOTS = 7;

export function SnusCan3D({ product, size = 260, interactive = true, className, onSwipe }: SnusCan3DProps) {
  const canRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef(-16);
  const velRef = useRef(0.16);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const startXRef = useRef(0);
  const idleRef = useRef(true);

  // Animate purely through the DOM – no re-render per frame
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!draggingRef.current) {
        if (idleRef.current) {
          velRef.current += (0.16 - velRef.current) * 0.04;
        } else {
          velRef.current *= 0.94;
        }
        spinRef.current += velRef.current;
      }
      if (canRef.current) {
        canRef.current.style.transform =
          `translate(-50%, -50%) rotateX(${TILT}deg) rotateY(${spinRef.current}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    draggingRef.current = true;
    idleRef.current = false;
    lastXRef.current = e.clientX;
    startXRef.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    spinRef.current += dx * 0.7;
    velRef.current = dx * 0.7;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const total = e.clientX - startXRef.current;
    if (onSwipe && Math.abs(total) > size * 0.55) {
      onSwipe(total < 0 ? 1 : -1);
    }
  };

  const radius = size / 2;
  const canHeight = Math.round(size * 0.3);
  const segWidth = (2 * Math.PI * radius) / SEGMENTS + 1.4;
  const lidBase = product.white ? '#f8f8f5' : '#eee3d3';
  const brandWord = product.brand.toLowerCase();
  const bigNumber = product.number != null ? `${product.number}` : null;

  return (
    <div
      className={cn('flex flex-col items-center select-none', className)}
      style={{ touchAction: interactive ? 'pan-y' : undefined }}
    >
      <div
        className="relative"
        style={{ width: size, height: Math.round(size * 0.82), perspective: `${size * 3.2}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Contact shadow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-[50%] blur-lg"
          style={{
            width: size * 0.92,
            height: size * 0.16,
            bottom: size * 0.03,
            background: 'rgba(0,0,0,0.34)',
          }}
        />

        <div
          ref={canRef}
          className={cn('absolute left-1/2 top-1/2', interactive && 'cursor-grab active:cursor-grabbing')}
          style={{
            width: size,
            height: canHeight,
            transformStyle: 'preserve-3d',
            transform: `translate(-50%, -50%) rotateX(${TILT}deg) rotateY(-16deg)`,
          }}
        >
          {/* Bottom disc – keeps the can opaque when rotated */}
          <div
            className="absolute left-0 rounded-full"
            style={{
              width: size,
              height: size,
              top: '50%',
              marginTop: -size / 2,
              transform: `rotateX(-90deg) translateZ(${-canHeight / 2}px)`,
              background: `radial-gradient(circle at 60% 65%, #d8d6cf 0%, #b9b7b0 70%, #97958f 100%)`,
            }}
          />

          {/* Side wall */}
          {Array.from({ length: SEGMENTS }).map((_, i) => {
            const angle = (360 / SEGMENTS) * i;
            const rad = (angle * Math.PI) / 180;
            const light = 0.5 + 0.6 * Math.max(0, Math.cos(rad - Math.PI / 5));
            const showText = i % 10 === 0;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 overflow-hidden"
                style={{
                  width: segWidth,
                  height: canHeight,
                  marginLeft: -segWidth / 2,
                  marginTop: -canHeight / 2,
                  transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                  background: `linear-gradient(to bottom,
                    rgba(255,255,255,0.55) 0%,
                    ${product.accent} 6%,
                    ${product.accent} 58%,
                    ${lidBase} 58%,
                    #cfcdc6 100%)`,
                  filter: `brightness(${light.toFixed(3)})`,
                  backfaceVisibility: 'hidden',
                }}
              >
                {showText && (
                  <span
                    className="absolute inset-x-0 top-[16%] text-center font-extrabold tracking-tight"
                    style={{ fontSize: canHeight * 0.28, color: lidBase, lineHeight: 1 }}
                  >
                    {brandWord}
                  </span>
                )}
              </div>
            );
          })}

          {/* Lid */}
          <div
            className="absolute left-0 rounded-full overflow-hidden"
            style={{
              width: size,
              height: size,
              top: '50%',
              marginTop: -size / 2,
              transform: `rotateX(-90deg) translateZ(${canHeight / 2}px)`,
              background: `radial-gradient(circle at 30% 22%, #ffffff 0%, ${lidBase} 52%, #dedcd4 88%, #c7c5bd 100%)`,
              boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.07), inset 0 0 26px rgba(0,0,0,0.08)',
            }}
          >
            {/* Outer rim ring in brand colour */}
            <div
              className="absolute inset-[2.5%] rounded-full"
              style={{ border: `${Math.max(2, size * 0.012)}px solid ${product.accent}`, opacity: 0.9 }}
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center px-[13%] text-center">
              <span
                className="font-black tracking-tight"
                style={{ fontSize: size * 0.155, color: '#1f2429', lineHeight: 1 }}
              >
                {brandWord}
              </span>

              {bigNumber ? (
                <span
                  className="font-black leading-none"
                  style={{ fontSize: size * 0.3, color: product.accent, marginTop: size * 0.01 }}
                >
                  {bigNumber}
                </span>
              ) : (
                <span
                  className="uppercase tracking-[0.24em]"
                  style={{ fontSize: size * 0.05, color: '#4a5158', marginTop: size * 0.02 }}
                >
                  {product.white ? 'white' : 'original'}
                </span>
              )}

              <span
                className="font-semibold"
                style={{ fontSize: size * 0.058, color: '#2b3138', marginTop: size * 0.012 }}
              >
                {product.flavor}
              </span>

              <span
                className="uppercase tracking-[0.2em]"
                style={{ fontSize: size * 0.04, color: '#7a8087', marginTop: size * 0.01 }}
              >
                {product.nicotineFree ? 'nikotinfri' : product.format ?? (product.white ? 'white' : 'original')}
              </span>

              <span className="flex gap-[2px]" style={{ marginTop: size * 0.022 }}>
                {Array.from({ length: STRENGTH_DOTS }).map((_, i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      width: size * 0.026,
                      height: size * 0.026,
                      background: i < product.strength ? product.accent : 'transparent',
                      border: `1px solid ${product.accent}`,
                      opacity: i < product.strength ? 1 : 0.4,
                    }}
                  />
                ))}
              </span>
            </div>

            {/* Glossy sweep */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'linear-gradient(125deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.06) 38%, rgba(255,255,255,0) 58%)',
              }}
            />
          </div>
        </div>
      </div>

      {interactive && <p className="mt-1 text-xs text-muted-foreground">Dra for å rotere</p>}
    </div>
  );
}
