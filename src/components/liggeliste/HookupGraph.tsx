import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Leader } from '@/types/database';
import type { Hookup } from '@/hooks/useHookups';

/**
 * Circular network view of confirmed connections.
 * Leaders are placed on a circle, connections drawn as lines between them.
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

  const nodes = useMemo(() => {
    const involved = new Set<string>();
    hookups.forEach((h) => {
      involved.add(h.leader_a_id);
      involved.add(h.leader_b_id);
    });
    const list = leaders.filter((l) => involved.has(l.id));
    const r = 42;
    return list.map((leader, i) => {
      const angle = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        leader,
        x: 50 + Math.cos(angle) * r,
        y: 50 + Math.sin(angle) * r,
      };
    });
  }, [leaders, hookups]);

  const posById = useMemo(
    () => new Map(nodes.map((n) => [n.leader.id, n])),
    [nodes],
  );

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
      <div className="rounded-2xl border border-border/60 bg-card/70 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Ingen bekreftede koblinger ennå. Kartet fylles opp når begge parter har bekreftet.
        </p>
      </div>
    );
  }

  const selectedLeader = selected ? leaders.find((l) => l.id === selected) : null;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {hookups.map((h) => {
            const a = posById.get(h.leader_a_id);
            const b = posById.get(h.leader_b_id);
            if (!a || !b) return null;
            const active =
              !selected || h.leader_a_id === selected || h.leader_b_id === selected;
            return (
              <line
                key={h.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                strokeWidth={active ? 0.6 : 0.3}
                className={cn(
                  'transition-opacity',
                  active ? 'text-primary opacity-70' : 'text-muted-foreground opacity-15',
                )}
              />
            );
          })}
        </svg>

        {nodes.map(({ leader, x, y }) => {
          const dimmed = !!selected && selected !== leader.id && !partnersOfSelected.has(leader.id);
          return (
            <button
              key={leader.id}
              type="button"
              onClick={() => setSelected((s) => (s === leader.id ? null : leader.id))}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 transition-opacity',
                dimmed ? 'opacity-25' : 'opacity-100',
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <Avatar
                className={cn(
                  'h-9 w-9 border-2 shadow-sm',
                  leader.id === myLeaderId ? 'border-primary' : 'border-background',
                )}
              >
                <AvatarImage src={leader.profile_image_url ?? undefined} alt={leader.name} />
                <AvatarFallback className="text-[10px]">
                  {leader.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>
            </button>
          );
        })}
      </div>

      {selectedLeader && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <p className="text-sm font-semibold text-foreground">{selectedLeader.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {partnersOfSelected.size} bekreftede koblinger
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...partnersOfSelected].map((id) => {
              const l = leaders.find((x) => x.id === id);
              if (!l) return null;
              return (
                <span
                  key={id}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {l.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}