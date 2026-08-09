import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Search, Heart, UserRound } from 'lucide-react';
import type { Leader } from '@/types/database';
import type { Hookup } from '@/hooks/useHookups';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}

/** Always-readable alternative to the map: every confirmed pair as a row. */
export function HookupList({
  leaders,
  hookups,
  myLeaderId,
}: {
  leaders: Leader[];
  hookups: Hookup[];
  myLeaderId?: string;
}) {
  const [search, setSearch] = useState('');
  const leaderById = useMemo(() => new Map(leaders.map((l) => [l.id, l])), [leaders]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hookups
      .map((h) => ({
        h,
        a: leaderById.get(h.leader_a_id),
        b: leaderById.get(h.leader_b_id),
      }))
      .filter((r) => r.a && r.b)
      .filter((r) =>
        q ? r.a!.name.toLowerCase().includes(q) || r.b!.name.toLowerCase().includes(q) : true,
      )
      .sort((r1, r2) => r1.a!.name.localeCompare(r2.a!.name, 'nb'));
  }, [hookups, leaderById, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk etter navn"
          className="pl-9"
          maxLength={60}
        />
      </div>

      {rows.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">Ingen koblinger å vise.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(({ h, a, b }) => {
            const mine = !!myLeaderId && (h.leader_a_id === myLeaderId || h.leader_b_id === myLeaderId);
            return (
              <div
                key={h.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  mine ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card/70'
                }`}
              >
                {[a!, b!].map((l, i) => (
                  <div key={l.id + i} className="flex min-w-0 flex-1 items-center gap-2">
                    {i === 1 && <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={l.profile_image_url ?? undefined} alt={l.name} />
                      <AvatarFallback className="text-[10px]">{initials(l.name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 items-center gap-1 truncate text-sm text-foreground">
                      <span className="truncate">{l.name}</span>
                      {l.is_external && <UserRound className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}