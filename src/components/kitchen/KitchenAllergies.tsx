import { useMemo, useState } from 'react';
import { AlertTriangle, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { useKitchenAllergies } from '@/hooks/useKitchenAllergies';
import { ALLERGY_CATEGORIES } from '@/lib/allergyDetect';

export function KitchenAllergies() {
  const { data, isLoading } = useKitchenAllergies();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const hits = data?.hits ?? [];
  const counts = data?.counts ?? {};

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hits.filter((h) => {
      if (filter && !h.categories.includes(filter)) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        (h.cabin_name || '').toLowerCase().includes(q) ||
        h.quotes.join(' ').toLowerCase().includes(q)
      );
    });
  }, [hits, search, filter, ]);

  const labelFor = (key: string) =>
    ALLERGY_CATEGORIES.find((c) => c.key === key)?.label ?? key;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALLERGY_CATEGORIES.filter((c) => counts[c.key]).map((c) => {
          const isActive = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => { hapticImpact('light'); setFilter(isActive ? null : c.key); }}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border/60 bg-card/70 hover:bg-card',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-foreground leading-tight">{c.label}</span>
                <span className="text-lg font-heading font-bold text-primary">{counts[c.key]}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{c.hint}</p>
            </button>
          );
        })}
        {Object.keys(counts).length === 0 && (
          <div className="col-span-full rounded-xl border border-border/60 bg-card/70 p-4 text-sm text-muted-foreground">
            Ingen matallergier funnet i deltagerinformasjonen for denne perioden.
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        <span>{hits.length} deltagere med matallergi eller spesialkost</span>
        {filter && (
          <button type="button" className="underline" onClick={() => setFilter(null)}>
            Nullstill filter
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk navn, hytte eller notat..."
          className="pl-9"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {visible.map((h) => (
          <div key={h.participant_id} className="rounded-xl border border-border/60 bg-card/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                {(h.cabin_name || h.room) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[h.cabin_name, h.room].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1 justify-end shrink-0">
                {h.categories.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[10px]">
                    {labelFor(c)}
                  </Badge>
                ))}
              </div>
            </div>
            {h.quotes.map((q, i) => (
              <p key={i} className="mt-2 flex gap-1.5 text-xs text-muted-foreground leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{q}</span>
              </p>
            ))}
          </div>
        ))}
        {visible.length === 0 && hits.length > 0 && (
          <p className="text-sm text-muted-foreground">Ingen treff.</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Listen finnes automatisk fra booking-notater, helseinfo og deltagernotater. Sjekk alltid med
        sykepleier ved tvil.
      </p>
    </div>
  );
}
