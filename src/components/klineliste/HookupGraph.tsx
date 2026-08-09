import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Heart, Minus, Plus, Crosshair, Search, X, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Leader } from '@/types/database';
import type { Hookup } from '@/hooks/useHookups';
import { computeHookupLayout, neighbourhood, LAYOUT_SIZE } from '@/lib/hookupLayout';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}

function firstName(name: string) {
  return name.split(' ')[0];
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 6;
const NODE_R = 26;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Photo-first network view of confirmed connections.
 *
 * Built to survive 100+ leaders on a phone: force-directed layout inside a
 * pannable/pinch-zoomable SVG surface, with detail level tied to zoom.
 */
export function HookupGraph({
  leaders,
  hookups,
  myLeaderId,
}: {
  leaders: Leader[];
  hookups: Hookup[];
  myLeaderId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [myNetOnly, setMyNetOnly] = useState(false);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);

  const visibleHookups = useMemo(() => {
    if (!myNetOnly || !myLeaderId) return hookups;
    const net = neighbourhood(myLeaderId, hookups, 2);
    return hookups.filter((h) => net.has(h.leader_a_id) && net.has(h.leader_b_id));
  }, [hookups, myNetOnly, myLeaderId]);

  const leaderById = useMemo(() => new Map(leaders.map((l) => [l.id, l])), [leaders]);

  const ids = useMemo(() => {
    const set = new Set<string>();
    visibleHookups.forEach((h) => {
      if (leaderById.has(h.leader_a_id)) set.add(h.leader_a_id);
      if (leaderById.has(h.leader_b_id)) set.add(h.leader_b_id);
    });
    return [...set].sort();
  }, [visibleHookups, leaderById]);

  const layout = useMemo(
    () => computeHookupLayout(ids, visibleHookups, ids.length > 160 ? 140 : 260),
    [ids, visibleHookups],
  );
  const posById = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);
  const maxDeg = useMemo(() => Math.max(1, ...layout.map((n) => n.deg)), [layout]);

  const partnersOfSelected = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>();
    visibleHookups.forEach((h) => {
      if (h.leader_a_id === selected) set.add(h.leader_b_id);
      if (h.leader_b_id === selected) set.add(h.leader_a_id);
    });
    return set;
  }, [selected, visibleHookups]);

  const zoomAt = useCallback((nextK: number, px: number, py: number) => {
    setView((v) => {
      const k = clamp(nextK, MIN_ZOOM, MAX_ZOOM);
      const ratio = k / v.k;
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  const centerOn = useCallback((id: string) => {
    const node = posById.get(id);
    const el = containerRef.current;
    if (!node || !el) return;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / LAYOUT_SIZE;
    const k = Math.max(viewRef.current.k, 2.2);
    setView({
      k,
      x: rect.width / 2 - node.x * scale * k,
      y: rect.height / 2 - node.y * scale * k,
    });
    setSelected(id);
  }, [posById]);

  // Native, non-passive wheel handling (React's onWheel is passive).
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(viewRef.current.k * Math.exp(-dy * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const localPoint = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, localPoint(e));
    moved.current = false;
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
        cx: (p1.x + p2.x) / 2,
        cy: (p1.y + p2.y) / 2,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const next = localPoint(e);
    pointers.current.set(e.pointerId, next);

    if (pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const g = gesture.current;
      if (g) {
        moved.current = true;
        zoomAt(viewRef.current.k * (dist / g.dist), g.cx, g.cy);
        gesture.current = { dist, cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 };
      }
      return;
    }

    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return layout
      .map((n) => leaderById.get(n.id))
      .filter((l): l is Leader => !!l && l.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, layout, leaderById]);

  if (layout.length === 0) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 p-8 text-center">
        <Heart className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-muted-foreground">
          {myNetOnly
            ? 'Ingen koblinger i ditt nett ennå.'
            : 'Ingen bekreftede koblinger ennå. Kartet fylles opp når begge parter har bekreftet.'}
        </p>
        {myNetOnly && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setMyNetOnly(false)}>
            Vis hele kartet
          </Button>
        )}
      </div>
    );
  }

  const selectedLeader = selected ? leaderById.get(selected) : null;
  const showPhotos = view.k >= 0.75;
  const showLabels = view.k >= 1.6;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk i kartet"
          className="pl-9"
          maxLength={60}
        />
        {searchMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg">
            {searchMatches.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  centerOn(l.id);
                  setSearch('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={l.profile_image_url ?? undefined} alt={l.name} />
                  <AvatarFallback className="text-[9px]">{initials(l.name)}</AvatarFallback>
                </Avatar>
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{layout.length}</span> ledere ·{' '}
          <span className="font-semibold text-foreground">{visibleHookups.length}</span> koblinger
        </span>
        {myLeaderId && (
          <button
            type="button"
            onClick={() => setMyNetOnly((v) => !v)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              myNetOnly ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            Mitt nett
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          const rect = containerRef.current!.getBoundingClientRect();
          zoomAt(viewRef.current.k * 1.8, e.clientX - rect.left, e.clientY - rect.top);
        }}
        className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-primary/5 backdrop-blur"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

        <svg viewBox={`0 0 ${LAYOUT_SIZE} ${LAYOUT_SIZE}`} className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="hookup-link" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
            </linearGradient>
            <clipPath id="hookup-node-clip" clipPathUnits="userSpaceOnUse">
              <circle cx="0" cy="0" r={NODE_R} />
            </clipPath>
          </defs>

          <g
            transform={`translate(${(view.x / (containerRef.current?.clientWidth || LAYOUT_SIZE)) * LAYOUT_SIZE} ${
              (view.y / (containerRef.current?.clientWidth || LAYOUT_SIZE)) * LAYOUT_SIZE
            }) scale(${view.k})`}
          >
            {visibleHookups.map((h) => {
              const a = posById.get(h.leader_a_id);
              const b = posById.get(h.leader_b_id);
              if (!a || !b) return null;
              const active = !selected || h.leader_a_id === selected || h.leader_b_id === selected;
              const mine = !!myLeaderId && (h.leader_a_id === myLeaderId || h.leader_b_id === myLeaderId);
              const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08;
              const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08;
              return (
                <path
                  key={h.id}
                  d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={active ? 'url(#hookup-link)' : 'hsl(var(--muted-foreground))'}
                  strokeWidth={(active ? (mine ? 4.5 : 3) : 1.5) / view.k}
                  strokeLinecap="round"
                  className={cn('transition-opacity', active ? 'opacity-80' : 'opacity-15')}
                />
              );
            })}

            {layout.map((node) => {
              const leader = leaderById.get(node.id);
              if (!leader) return null;
              const dimmed = !!selected && selected !== node.id && !partnersOfSelected.has(node.id);
              const isMe = node.id === myLeaderId;
              const hot = node.deg === maxDeg && maxDeg > 1;
              const r = NODE_R * (0.8 + 0.45 * (node.deg / maxDeg));
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className={cn('cursor-pointer transition-opacity', dimmed ? 'opacity-20' : 'opacity-100')}
                  onClick={() => {
                    if (moved.current) return;
                    setSelected((s) => (s === node.id ? null : node.id));
                  }}
                >
                  <circle
                    r={r}
                    fill={isMe ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    stroke={selected === node.id || isMe ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                    strokeWidth={3 / view.k}
                  />
                  {showPhotos && leader.profile_image_url && (
                    <image
                      href={leader.profile_image_url}
                      x={-r}
                      y={-r}
                      width={r * 2}
                      height={r * 2}
                      clipPath="url(#hookup-node-clip)"
                      transform={`scale(${r / NODE_R})`}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ transformBox: 'fill-box' }}
                    />
                  )}
                  {showPhotos && !leader.profile_image_url && (
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={r * 0.7}
                      fill="hsl(var(--background))"
                      fontWeight="600"
                    >
                      {initials(leader.name)}
                    </text>
                  )}
                  {showLabels && (
                    <text
                      y={r + 14}
                      textAnchor="middle"
                      fontSize={14}
                      fill="hsl(var(--foreground))"
                      opacity={0.8}
                    >
                      {firstName(leader.name)}
                    </text>
                  )}
                  {hot && (
                    <circle r={r * 0.22} cx={r * 0.7} cy={r * 0.7} fill="hsl(var(--primary))" />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full shadow"
            onClick={() => {
              const w = containerRef.current?.clientWidth ?? 0;
              zoomAt(viewRef.current.k * 1.4, w / 2, w / 2);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full shadow"
            onClick={() => {
              const w = containerRef.current?.clientWidth ?? 0;
              zoomAt(viewRef.current.k / 1.4, w / 2, w / 2);
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full shadow"
            onClick={() => {
              setView({ k: 1, x: 0, y: 0 });
              setSelected(null);
            }}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>

        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium backdrop-blur"
          >
            <X className="h-3 w-3" /> Fokus av
          </button>
        )}
      </div>

      {selectedLeader && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-primary ring-offset-2 ring-offset-background">
              <AvatarImage
                src={selectedLeader.profile_image_url ?? undefined}
                alt={selectedLeader.name}
                className="object-cover"
              />
              <AvatarFallback className="text-xs">{initials(selectedLeader.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {selectedLeader.name}
                {selectedLeader.is_external && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <UserRound className="h-2.5 w-2.5" /> manuelt
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {partnersOfSelected.size} bekreftede koblinger
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...partnersOfSelected].map((id) => {
              const l = leaderById.get(id);
              if (!l) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => centerOn(id)}
                  className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2.5 text-[11px] text-muted-foreground"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={l.profile_image_url ?? undefined}
                      alt={l.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-[8px]">{initials(l.name)}</AvatarFallback>
                  </Avatar>
                  {l.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
