import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Leader } from '@/types/database';
import type { Hookup } from '@/hooks/useHookups';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}

function firstName(name: string) {
  return name.split(' ')[0];
}

/**
 * Photo-first network view of confirmed connections.
 * Leaders sit on a circle with their profile photo, links are drawn as
 * soft curves that bend toward the centre.
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

  const degree = useMemo(() => {
    const m = new Map<string, number>();
    hookups.forEach((h) => {
      m.set(h.leader_a_id, (m.get(h.leader_a_id) ?? 0) + 1);
      m.set(h.leader_b_id, (m.get(h.leader_b_id) ?? 0) + 1);
    });
    return m;
  }, [hookups]);

  const nodes = useMemo(() => {
    // Most-connected leaders first so the circle reads like a ranking.
    const list = leaders
      .filter((l) => degree.has(l.id))
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
    const r = 39;
    return list.map((leader, i) => {
      const angle = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        leader,
        deg: degree.get(leader.id) ?? 0,
        x: 50 + Math.cos(angle) * r,
        y: 50 + Math.sin(angle) * r,
      };
    });
  }, [leaders, degree]);

  const posById = useMemo(() => new Map(nodes.map((n) => [n.leader.id, n])), [nodes]);
  const maxDeg = useMemo(() => Math.max(1, ...nodes.map((n) => n.deg)), [nodes]);

  const partnersOfSelected = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>();
    hookups.forEach((h) => {
      if (h.leader_a_id === selected) set.add(h.leader_b_id);
      if (h.leader_b_id === selected) set.add(h.leader_a_id);
    });
    return set;
  }, [selected, hookups]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 p-8 text-center">
        <Heart className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-muted-foreground">
          Ingen bekreftede koblinger ennå. Kartet fylles opp når begge parter har bekreftet.
        </p>
      </div>
    );
  }

  const selectedLeader = selected ? leaders.find((l) => l.id === selected) : null;
  // Node size scales with popularity, and shrinks as the circle gets crowded.
  const base = nodes.length > 20 ? 40 : nodes.length > 12 ? 48 : 56;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{nodes.length}</span> ledere ·{' '}
          <span className="font-semibold text-foreground">{hookups.length}</span> koblinger
        </span>
        <span className="text-[11px] text-muted-foreground">Trykk på et bilde</span>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-primary/5 backdrop-blur">
        {/* soft glow behind the web */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="hookup-link" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {hookups.map((h) => {
            const a = posById.get(h.leader_a_id);
            const b = posById.get(h.leader_b_id);
            if (!a || !b) return null;
            const active = !selected || h.leader_a_id === selected || h.leader_b_id === selected;
            const mine = !!myLeaderId && (h.leader_a_id === myLeaderId || h.leader_b_id === myLeaderId);
            // Curve control point pulled toward the middle for a web-like look.
            const cx = 50 + (a.x + b.x - 100) * 0.18;
            const cy = 50 + (a.y + b.y - 100) * 0.18;
            return (
              <path
                key={h.id}
                d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                fill="none"
                stroke={active ? 'url(#hookup-link)' : 'hsl(var(--muted-foreground))'}
                strokeWidth={active ? (mine ? 0.9 : 0.6) : 0.3}
                strokeLinecap="round"
                className={cn('transition-opacity', active ? 'opacity-80' : 'opacity-15')}
              />
            );
          })}
        </svg>

        {nodes.map(({ leader, x, y, deg }) => {
          const dimmed = !!selected && selected !== leader.id && !partnersOfSelected.has(leader.id);
          const isMe = leader.id === myLeaderId;
          const size = Math.round(base * (0.82 + 0.28 * (deg / maxDeg)));
          const hot = deg === maxDeg && maxDeg > 1;
          return (
            <button
              key={leader.id}
              type="button"
              onClick={() => setSelected((s) => (s === leader.id ? null : leader.id))}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-300',
                dimmed ? 'scale-90 opacity-25' : 'opacity-100',
                selected === leader.id && 'scale-110',
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="relative">
                <Avatar
                  className={cn(
                    'shadow-lg ring-2 ring-offset-2 ring-offset-background',
                    isMe ? 'ring-primary' : 'ring-border',
                    selected === leader.id && 'ring-primary',
                  )}
                  style={{ height: size, width: size }}
                >
                  <AvatarImage
                    src={leader.image_thumb_url ?? leader.profile_image_url ?? undefined}
                    alt={leader.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-xs font-semibold">{initials(leader.name)}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 flex min-w-[18px] items-center justify-center gap-0.5 rounded-full bg-primary px-1 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow">
                  {hot ? <Flame className="h-2.5 w-2.5" /> : null}
                  {deg}
                </span>
              </span>
              <span className="mt-1.5 max-w-[72px] truncate text-[10px] font-medium text-foreground/80">
                {firstName(leader.name)}
              </span>
            </button>
          );
        })}
      </div>

      {selectedLeader && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-primary ring-offset-2 ring-offset-background">
              <AvatarImage
                src={selectedLeader.image_thumb_url ?? selectedLeader.profile_image_url ?? undefined}
                alt={selectedLeader.name}
                className="object-cover"
              />
              <AvatarFallback className="text-xs">{initials(selectedLeader.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedLeader.name}</p>
              <p className="text-xs text-muted-foreground">
                {partnersOfSelected.size} bekreftede koblinger
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...partnersOfSelected].map((id) => {
              const l = leaders.find((x) => x.id === id);
              if (!l) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2.5 text-[11px] text-muted-foreground"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={l.image_thumb_url ?? l.profile_image_url ?? undefined}
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
