import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface RailPage {
  key: string;
  content: React.ReactNode;
}

const SNAP = 'transform 320ms cubic-bezier(0.32, 0.72, 0.28, 1)';

/**
 * Horizontal swipe rail — one page at a time, GPU-composited translate3d,
 * 3-page virtualization (prev/current/next) so paging stays smooth.
 */
export function PassRail({
  pages,
  index,
  onIndexChange,
  className,
}: {
  pages: RailPage[];
  index: number;
  onIndexChange: (next: number) => void;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    dx: 0,
    locked: false as boolean | 'x' | 'y',
    startTime: 0,
  });

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyTransform = useCallback(
    (offset: number, animate: boolean) => {
      const rail = railRef.current;
      if (!rail) return;
      rail.style.transition = animate ? SNAP : 'none';
      rail.style.transform = `translate3d(${offset}px, 0, 0)`;
    },
    [],
  );

  // Snap to the active page whenever index or width changes.
  useEffect(() => {
    if (dragRef.current.active) return;
    applyTransform(-index * width, true);
  }, [index, width, applyTransform]);

  const clamp = (i: number) => Math.max(0, Math.min(pages.length - 1, i));

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const d = dragRef.current;
    d.active = true;
    d.pointerId = e.pointerId;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.dx = 0;
    d.locked = false;
    d.startTime = performance.now();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.locked === 'y') {
        d.active = false;
        return;
      }
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }

    // Rubber-band at the ends.
    let eff = dx;
    const atStart = index === 0 && dx > 0;
    const atEnd = index === pages.length - 1 && dx < 0;
    if (atStart || atEnd) eff = dx * 0.35;

    d.dx = eff;
    applyTransform(-index * width + eff, false);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const dx = d.dx;
    const elapsed = Math.max(1, performance.now() - d.startTime);
    const velocity = Math.abs(dx) / elapsed; // px/ms
    d.active = false;
    d.locked = false;

    const threshold = width * 0.22;
    let next = index;
    if (dx <= -threshold || (dx < -12 && velocity > 0.55)) next = clamp(index + 1);
    else if (dx >= threshold || (dx > 12 && velocity > 0.55)) next = clamp(index - 1);

    d.dx = 0;
    if (next === index) applyTransform(-index * width, true);
    else onIndexChange(next);
  };

  return (
    <div
      ref={viewportRef}
      className={cn('relative overflow-hidden touch-pan-y select-none', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ contain: 'paint' }}
    >
      <div
        ref={railRef}
        className="flex h-full will-change-transform"
        style={{ transform: `translate3d(${-index * width}px, 0, 0)` }}
      >
        {pages.map((page, i) => {
          const mounted = Math.abs(i - index) <= 1;
          return (
            <div
              key={page.key}
              className="relative h-full shrink-0 grow-0"
              style={{ width: width || '100%' }}
              aria-hidden={i !== index}
            >
              {mounted ? page.content : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PassRail;