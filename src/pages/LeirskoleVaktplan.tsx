import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Moon } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useLeirskoleActivityAssignments,
  useLeirskoleSchedule,
  useLeirskoleStaff,
} from '@/hooks/useLeirskole';
import { useAuth } from '@/contexts/AuthContext';
import { competenceEmoji, competenceLabel } from '@/lib/leirskoleCompetencies';
import { sessionLabel } from '@/lib/leirskoleActivities';

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const dayLabel = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}. ${MONTHS[date.getMonth()]}`;
};
const hhmm = (t: string) => t.slice(0, 5);
const todayStr = () => new Date().toLocaleDateString('sv-SE');

export default function LeirskoleVaktplan() {
  const { isAdmin } = useAuth();
  const { data: week, isLoading } = useActiveLeirskoleWeek();
  const published = !!week?.schedule_published_at || isAdmin;
  const { data: posts } = useLeirskoleSchedule(published ? week?.id : null);
  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: activities } = useLeirskoleActivityAssignments(week?.id);
  const today = todayStr();

  const nameByStaffId = useMemo(() => {
    const map = new Map<string, string>();
    (staff ?? []).forEach((s) => map.set(s.id, s.leader?.name ?? 'Ukjent'));
    return map;
  }, [staff]);

  const nameByLeaderId = useMemo(() => {
    const map = new Map<string, string>();
    (staff ?? []).forEach((s) => s.leader && map.set(s.leader.id, s.leader.name));
    return map;
  }, [staff]);

  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof posts>>();
    (posts ?? []).forEach((p) => {
      groups.set(p.date, [...(groups.get(p.date) ?? []), p] as NonNullable<typeof posts>);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-6 animate-fade-in">
      <header className="oks-glass-card p-4">
        <h1 className="text-[22px] font-heading font-bold leading-tight">Hele vaktplanen</h1>
        <p className="mt-1 text-sm text-muted-foreground">{week?.name ?? 'Ingen aktiv uke'}</p>
      </header>

      {!week ? (
        <p className="text-sm text-muted-foreground">Ingen aktiv leirskoleuke.</p>
      ) : byDay.length === 0 ? (
        <p className="oks-glass-card p-4 text-sm text-muted-foreground">
          {week.schedule_published_at ? 'Ingen vakter lagt inn ennå.' : 'Vaktplanen er ikke publisert ennå.'}
        </p>
      ) : (
        byDay.map(([date, dayPosts]) => {
          const dayActivities = (activities ?? []).filter((a) => a.date === date);
          return (
            <section key={date} className="oks-glass-card p-4">
              <h2 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${date === today ? 'text-primary' : 'text-muted-foreground'}`}>
                <CalendarDays className="h-3.5 w-3.5" /> {dayLabel(date)}{date === today ? ' · i dag' : ''}
              </h2>

              <div className="mt-3 space-y-2">
                {(dayPosts ?? []).map((p) => (
                  <div key={p.id} className="oks-pill px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <Badge variant="secondary" className="tabular-nums shrink-0">
                        {hhmm(p.start_time)}–{hhmm(p.end_time)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {(p.is_night || p.crosses_midnight) && <Moon className="h-3 w-3" />}
                      {(p.assignments ?? []).map((a) => nameByStaffId.get(a.staff_id) ?? '—').join(', ') || 'Ingen satt opp'}
                    </p>
                  </div>
                ))}
              </div>

              {dayActivities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dayActivities.map((a) => (
                    <span key={a.id} className="oks-pill px-2.5 py-1 text-[11px] font-medium">
                      {competenceEmoji(a.activity)} {competenceLabel(a.activity)} ·{' '}
                      {nameByLeaderId.get(a.leader_id) ?? 'Ukjent'} ({sessionLabel(a.session).toLowerCase()})
                    </span>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
