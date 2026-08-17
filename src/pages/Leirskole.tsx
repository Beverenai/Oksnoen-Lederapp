import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, MessageCircle, ClipboardList, Clock, Moon } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useLeirskoleSchedule,
  useLeirskoleStaff,
  useLeirskoleTasks,
  useMyLeirskoleShifts,
  useToggleLeirskoleTask,
} from '@/hooks/useLeirskole';

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d}. ${MONTHS[m - 1]}`;
}
const hhmm = (t: string) => t.slice(0, 5);

export default function Leirskole() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const published = !!week?.schedule_published_at || isAdmin;
  const { data: myShifts, isLoading: shiftsLoading } = useMyLeirskoleShifts(week?.id);
  const { data: posts } = useLeirskoleSchedule(published ? week?.id : null);
  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: tasks } = useLeirskoleTasks(week?.id);
  const toggleTask = useToggleLeirskoleTask();

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    (staff ?? []).forEach((s) => map.set(s.id, s.leader?.name ?? 'Ukjent'));
    return map;
  }, [staff]);

  const myHours = useMemo(
    () => (myShifts ?? []).reduce((sum, p) => sum + Number(p.duration_hours ?? 0), 0),
    [myShifts],
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, typeof posts>();
    (posts ?? []).forEach((p) => {
      groups.set(p.date, [...(groups.get(p.date) ?? []), p] as any);
    });
    return [...groups.entries()];
  }, [posts]);

  const myTasks = (tasks ?? []).filter(
    (t) => t.assign_all || (t.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
  );

  if (weekLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!week) {
    return (
      <div className="py-16 text-center animate-fade-in">
        <CalendarDays className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-heading font-bold">Ingen aktiv leirskoleuke</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin må aktivere en uke først.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold lg:text-3xl">Leirskole</h1>
        <p className="text-sm text-muted-foreground">
          {week.name} · {dayLabel(week.start_date)} – {dayLabel(week.end_date)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-12 justify-start gap-2" onClick={() => navigate('/chat')}>
          <MessageCircle className="h-4 w-4" /> Leirskole-chat
        </Button>
        <Button variant="secondary" className="h-12 justify-start gap-2" onClick={() => navigate('/profile')}>
          <ClipboardList className="h-4 w-4" /> Min profil
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Mine vakter
          </CardTitle>
          <CardDescription>
            {myHours.toFixed(1)} timer denne uken · maks {Number(week.max_daily_hours ?? 8)}t per dag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {shiftsLoading ? (
            <Skeleton className="h-16" />
          ) : (myShifts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {week.schedule_published_at ? 'Du har ingen vakter denne uken.' : 'Vaktplanen er ikke publisert ennå.'}
            </p>
          ) : (
            (myShifts ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{dayLabel(p.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(p.is_night || p.crosses_midnight) && <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Badge variant="secondary" className="tabular-nums">
                    {hhmm(p.start_time)}–{hhmm(p.end_time)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Oppgaver fra admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen oppgaver akkurat nå.</p>
          ) : (
            myTasks.map((t) => (
              <label key={t.id} className="flex items-start gap-3 rounded-xl border bg-card/50 px-3 py-2">
                <Checkbox
                  checked={t.completedByMe}
                  onCheckedChange={(v) => toggleTask.mutate({ taskId: t.id, done: !!v })}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${t.completedByMe ? 'line-through text-muted-foreground' : ''}`}>
                    {t.title}
                  </p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      {published && byDay.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" /> Hele vaktplanen
            </CardTitle>
            {!week.schedule_published_at && (
              <CardDescription>Ikke publisert — kun synlig for admin.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {byDay.map(([date, dayPosts]) => (
              <div key={date} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel(date)}</p>
                {(dayPosts ?? []).map((p) => (
                  <div key={p.id} className="rounded-xl border bg-card/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <Badge variant="outline" className="tabular-nums">
                        {hhmm(p.start_time)}–{hhmm(p.end_time)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.assignments.length === 0
                        ? 'Ingen satt opp'
                        : p.assignments.map((a) => staffNames.get(a.staff_id) ?? '—').join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
