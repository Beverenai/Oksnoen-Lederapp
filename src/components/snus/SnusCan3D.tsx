import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SnusProduct } from '@/lib/snusCatalog';

interface SnusCan3DProps {
  product: SnusProduct;
  /** Diameter of the can in px */
  size?: number;
  interactive?: boolean;
  className?: string;
}

const SEGMENTS = 36;
const TILT = 58;

export function SnusCan3D({ product, size = 260, interactive = true, className }: SnusCan3DProps) {
  const [spin, setSpin] = useState(-18);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const idleRef = useRef(true);

  // Gentle idle rotation until the user grabs the can
  useEffect(() => {
    if (!interactive) return;
    let raf = 0;
    const tick = () => {
      if (idleRef.current && !draggingRef.current) {
        setSpin((s) => s + 0.12);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    draggingRef.current = true;
    idleRef.current = false;
    lastXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    setSpin((s) => s + dx * 0.6);
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  const radius = size / 2;
  const canHeight = Math.round(size * 0.3);
  const segWidth = (2 * Math.PI * radius) / SEGMENTS + 1.2;
  const lidBase = product.white ? '#f7f7f4' : '#efe7dc';
  const strengthDots = 5;

  return (
    <div
      className={cn('flex flex-col items-center select-none', className)}
      style={{ touchAction: interactive ? 'pan-y' : undefined }}
    >
      <div
        className="relative"
        style={{
          width: size,
          height: Math.round(size * 0.78),
          perspective: `${size * 3.4}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={cn('absolute left-1/2 top-1/2', interactive && 'cursor-grab active:cursor-grabbing')}
          style={{
            width: size,
            height: canHeight,
            transformStyle: 'preserve-3d',
            transform: `translate(-50%, -50%) rotateX(${TILT}deg) rotateY(${spin}deg)`,
          }}
        >
          {/* Side wall */}
          {Array.from({ length: SEGMENTS }).map((_, i) => {
            const angle = (360 / SEGMENTS) * i;
            const rad = (angle * Math.PI) / 180;
            const light = 0.45 + 0.55 * Math.max(0, Math.cos(rad - Math.PI / 6));
            const showText = i % 9 === 0;
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
                  background: `linear-gradient(to bottom, ${product.accent} 0%, ${product.accent} 62%, rgba(255,255,255,0.9) 62%, rgba(255,255,255,0.9) 100%)`,
                  filter: `brightness(${light.toFixed(3)})`,
                  backfaceVisibility: 'hidden',
                }}
              >
                {showText && (
                  <span
                    className="absolute inset-x-0 top-[14%] text-center font-extrabold tracking-tight"
                    style={{ fontSize: canHeight * 0.3, color: lidBase, lineHeight: 1 }}
                  >
                    {product.brand.split(' ')[0].toLowerCase()}
                  </span>
                )}
              </div>
            );
          })}

          {/* Lid */}
          <div
            className="absolute left-0 top-1/2 rounded-full overflow-hidden"
            style={{
              width: size,
              height: size,
              marginTop: -size / 2,
              transform: `rotateX(-90deg) translateZ(${canHeight / 2}px)`,
              background: `radial-gradient(circle at 32% 24%, #ffffff 0%, ${lidBase} 55%, #dcdad2 100%)`,
              boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.06)',
            }}
          >
            {/* accent arc */}
            <div
              className="absolute inset-[3%] rounded-full"
              style={{
                background: `conic-gradient(from 200deg, ${product.accent} 0deg 92deg, transparent 92deg 360deg)`,
                mask: 'radial-gradient(circle, transparent 0 82%, #000 82% 100%)',
                WebkitMask: 'radial-gradient(circle, transparent 0 82%, #000 82% 100%)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-[14%] text-center">
              <span
                className="font-black tracking-tight"
                style={{ fontSize: size * 0.17, color: '#22262b', lineHeight: 1 }}
              >
                {product.brand.toLowerCase()}
              </span>
              <span
                className="uppercase tracking-[0.22em] mt-[3%]"
                style={{ fontSize: size * 0.052, color: '#4a5158' }}
              >
                {product.white ? 'white' : 'original'}
              </span>
              <span
                className="italic font-semibold mt-[4%]"
                style={{ fontSize: size * 0.062, color: product.accent }}
              >
                {product.variant}
              </span>
              <span className="flex gap-[2px] mt-[4%]">
                {Array.from({ length: strengthDots }).map((_, i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      width: size * 0.028,
                      height: size * 0.028,
                      background: i < product.strength ? product.accent : 'transparent',
                      border: `1px solid ${product.accent}`,
                    }}
                  />
                ))}
              </span>
              <span
                className="uppercase tracking-[0.18em] mt-[4%]"
                style={{ fontSize: size * 0.042, color: '#6b7178' }}
              >
                strength s{product.strength}
              </span>
            </div>
          </div>
        </div>

        {/* Soft shadow under the can */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-[50%] blur-md"
          style={{
            width: size * 0.9,
            height: size * 0.14,
            bottom: size * 0.02,
            background: 'rgba(0,0,0,0.28)',
          }}
        />
      </div>

      {interactive && (
        <p className="mt-1 text-xs text-muted-foreground">Dra for å rotere</p>
      )}
    </div>
  );
}
