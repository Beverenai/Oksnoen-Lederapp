import { useRef, useState } from 'react';
import { Heart, X, Circle, Star, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';
import type { SwipeCandidate } from '@/hooks/useLeaderSwipes';

const THRESHOLD = 110;

/**
 * A single draggable leader card. Uses pointer events + CSS transforms so the
 * deck stays smooth on iPhone without extra animation libraries.
 */
export function SwipeCard({
  leader,
  onDecide,
  onSuperlike,
  interactive,
  depth = 0,
}: {
  leader: SwipeCandidate;
  onDecide: (liked: boolean) => void;
  onSuperlike?: () => void;
  interactive: boolean;
  depth?: number;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState<null | 'left' | 'right'>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const snus = leader.snus_user
    ? getSnusProduct(leader.snus_product_id) ?? customSnusProduct(leader.snus_custom_label || 'Snus')
    : null;

  const decide = (liked: boolean) => {
    setLeaving(liked ? 'right' : 'left');
    window.setTimeout(() => onDecide(liked), 220);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || leaving) return;
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  };

  const onPointerUp = () => {
    if (!start.current) return;
    const { x } = drag;
    start.current = null;
    if (Math.abs(x) > THRESHOLD) decide(x > 0);
    else setDrag({ x: 0, y: 0 });
  };

  const rotate = drag.x / 18;
  const transform = leaving
    ? `translate(${leaving === 'right' ? 520 : -520}px, -40px) rotate(${leaving === 'right' ? 22 : -22}deg)`
    : `translate(${drag.x}px, ${drag.y * 0.25}px) rotate(${rotate}deg) scale(${1 - depth * 0.04}) translateY(${depth * 10}px)`;

  const likeOpacity = Math.min(Math.max(drag.x / THRESHOLD, 0), 1);
  const nopeOpacity = Math.min(Math.max(-drag.x / THRESHOLD, 0), 1);

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        transform,
        transition: start.current ? 'none' : 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
        zIndex: 10 - depth,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-xl">
        {leader.profile_image_url ? (
          <img
            src={leader.profile_image_url}
            alt={leader.name}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-5xl font-bold text-muted-foreground">
            {leader.name.charAt(0)}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-16">
          <div className="flex items-end gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-white">{leader.name}</p>
              <p className="text-[12px] text-white/75">
                {leader.years.length > 0
                  ? `${leader.years.length} ${leader.years.length === 1 ? 'sesong' : 'sesonger'} · ${leader.years[0]}`
                  : 'Ingen registrerte sesonger'}
                {leader.is_external ? ' · manuelt lagt inn' : ''}
              </p>
              {snus && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                  <Circle className="h-3 w-3" /> {snus.name}
                </p>
              )}
            </div>
            {snus && (
              <div className="ml-auto shrink-0 pb-1">
                <SnusCan3D product={snus} size={46} interactive={false} spin={-22} hideHint />
              </div>
            )}
          </div>
        </div>

        {/* Sveipe-stempler */}
        <div
          className="pointer-events-none absolute left-4 top-4 rotate-[-12deg] rounded-xl border-4 border-emerald-400 px-3 py-1 text-xl font-black uppercase tracking-wide text-emerald-400"
          style={{ opacity: likeOpacity }}
        >
          Ja!
        </div>
        <div
          className="pointer-events-none absolute right-4 top-4 rotate-[12deg] rounded-xl border-4 border-rose-500 px-3 py-1 text-xl font-black uppercase tracking-wide text-rose-500"
          style={{ opacity: nopeOpacity }}
        >
          Nei
        </div>
      </div>

      {interactive && (
        <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => decide(false)}
            aria-label="Nei"
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-card shadow-md active:scale-95 transition-transform',
            )}
          >
            <X className="h-6 w-6 text-rose-500" strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={() => onSuperlike?.()}
            aria-label="Superlike (krever Øksnøen +)"
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-sky-400/50 bg-card shadow-md active:scale-95 transition-transform"
          >
            <Star className="h-5 w-5 text-sky-400/70" strokeWidth={2.6} />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background">
              <Lock className="h-2.5 w-2.5 text-muted-foreground" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            aria-label="Ja"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-card shadow-md active:scale-95 transition-transform"
          >
            <Heart className="h-6 w-6 text-emerald-500" strokeWidth={2.6} />
          </button>
        </div>
      )}
    </div>
  );
}
