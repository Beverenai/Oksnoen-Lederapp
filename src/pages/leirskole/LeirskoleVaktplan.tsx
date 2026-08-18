import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarDays, ChefHat, Moon } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useLeirskoleKitchenDays,
  useLeirskoleSchedule,
  useLeirskoleStaff,
} from '@/hooks/useLeirskole';
import { dayLabel, hhmm, todayStr } from '@/lib/leirskoleDates';

export default function LeirskoleVaktplan() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const published = !!week?.schedule_published_at || isAdmin;
  const { data: posts, isLoading } = useLeirskoleSchedule(published ? week?.id : null);
  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: kitchenDays } = useLeirskoleKitchenDays(week?.id);
  const today = todayStr();

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    (staff ?? []).forEach((s) => map.set(s.id, s.leader?.name ?? 'Ukjent'));
    return map;
  }, [staff]);

  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof posts>>();
    (posts ?? []).forEach((p) => {
      groups.set(p.date, [...(groups.get(p.date) ?? []), p] as NonNullable<typeof posts>);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  return (
    <div className="space-y-3 animate-fade-in pb-6">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" /> Tilbake
      </Button>

      <div className="oks-ls-pill p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Vaktplan</p>
        <h1 className="mt-0.5 text-2xl font-heading font-bold">{week?.name ?? 'Leirskole'}</h1>
        {!week?.schedule_published_at && (
          <p className="mt-1 text-xs text-muted-foreground">Ikke publisert ennå — kun synlig for admin.</p>
        )}
      </div>

      {weekLoading || isLoading ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : byDay.length === 0 ? (
        <p className="oks-ls-pill px-4 py-3 text-sm text-muted-foreground">Ingen vaktplan ennå.</p>
      ) : (
        byDay.map(([date, dayPosts]) => (
          <div key={date} className="oks-ls-pill p-4">
            <p className={`mb-2 flex items-center gap-2 text-sm font-semibold ${date === today ? 'text-primary' : ''}`}>
              <CalendarDays className="h-4 w-4 text-primary" /> {dayLabel(date)}{date === today ? ' · i dag' : ''}
            </p>
            {(kitchenDays ?? []).some((k) => k.date === date) && (
              <p className="mb-2 flex items-center gap-1.5 rounded-2xl bg-[hsl(var(--oks-ls-green))]/15 px-3 py-1.5 text-xs font-semibold text-[hsl(var(--oks-ls-green))]">
                <ChefHat className="h-3.5 w-3.5" /> Kjøkken hele dagen:{' '}
                {(kitchenDays ?? [])
                  .filter((k) => k.date === date)
                  .map((k) => staffNames.get(k.staff_id) ?? '—')
                  .join(', ')}
              </p>
            )}
            <div className="space-y-1.5">
              {(dayPosts ?? []).map((p) => (
                <div key={p.id} className="rounded-2xl bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{p.name}</p>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums">
                      {(p.is_night || p.crosses_midnight) && <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {hhmm(p.start_time)}–{hhmm(p.end_time)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.assignments.length === 0
                      ? 'Ingen satt opp'
                      : p.assignments.map((a) => staffNames.get(a.staff_id) ?? '—').join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
