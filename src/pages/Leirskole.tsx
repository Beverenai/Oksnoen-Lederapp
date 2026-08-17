import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarDays, MessageCircle, ClipboardList, Clock, Moon, Users, Settings, ChevronRight, Sun,
} from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useIsLeirskoleStaff,
  useLeirskoleSchedule,
  useLeirskoleStaff,
  useLeirskoleTasks,
  useMyLeirskoleShifts,
  useToggleLeirskoleTask,
} from '@/hooks/useLeirskole';

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

function parse(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dayLabel(dateStr: string) {
  const date = parse(dateStr);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}
function shortDate(dateStr: string) {
  const date = parse(dateStr);
  return `${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}
const hhmm = (t: string) => t.slice(0, 5);
const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

export default function Leirskole() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const published = !!week?.schedule_published_at || isAdmin;
  const { data: isStaff } = useIsLeirskoleStaff(week?.id);
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

  const today = todayStr();
  const shifts = myShifts ?? [];
  const myHours = useMemo(
    () => shifts.reduce((sum, p) => sum + Number(p.duration_hours ?? 0), 0),
    [shifts],
  );
  const todayShifts = shifts.filter((p) => p.date === today);
  const upcoming = shifts.filter((p) => p.date > today);
  const nextShift = todayShifts[0] ?? upcoming[0] ?? null;
  const todayHours = todayShifts.reduce((s, p) => s + Number(p.duration_hours ?? 0), 0);
  const maxDaily = Number(week?.max_daily_hours ?? 8);

  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof posts>>();
    (posts ?? []).forEach((p) => {
      groups.set(p.date, [...(groups.get(p.date) ?? []), p] as NonNullable<typeof posts>);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  const myTasks = (tasks ?? []).filter(
    (t) => t.assign_all || (t.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
  );
  const doneTasks = myTasks.filter((t) => t.completedByMe).length;
  const taskPct = myTasks.length ? Math.round((doneTasks / myTasks.length) * 100) : 0;

  if (weekLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24" />
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
        {isAdmin && (
          <Button className="mt-4" onClick={() => navigate('/admin/leirskole')}>
            <Settings className="mr-2 h-4 w-4" /> Leirskole-admin
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Header */}
      <div className="rounded-3xl border bg-gradient-to-br from-primary/12 via-card to-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Leirskole</p>
        <h1 className="mt-0.5 text-2xl font-heading font-bold leading-tight lg:text-3xl">{week.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {shortDate(week.start_date)} – {shortDate(week.end_date)}
          <Badge variant={week.schedule_published_at ? 'secondary' : 'outline'} className="ml-1">
            {week.schedule_published_at ? 'Vaktplan publisert' : 'Ikke publisert'}
          </Badge>
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border bg-card/70 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{myHours.toFixed(1)}t</p>
            <p className="text-[11px] text-muted-foreground">Mine timer</p>
          </div>
          <div className="rounded-2xl border bg-card/70 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{todayHours.toFixed(1)}/{maxDaily}t</p>
            <p className="text-[11px] text-muted-foreground">I dag</p>
          </div>
          <div className="rounded-2xl border bg-card/70 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{(staff ?? []).length}</p>
            <p className="text-[11px] text-muted-foreground">Ledere</p>
          </div>
        </div>
      </div>

      {isStaff === false && !isAdmin && (
        <p className="rounded-2xl border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground">
          Du er ikke satt opp på denne leirskoleuken ennå — du får vakter, oppgaver og chat når admin legger deg inn.
        </p>
      )}

      {/* Snarveier */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-12 justify-start gap-2" onClick={() => navigate('/chat')}>
          <MessageCircle className="h-4 w-4" /> Leirskole-chat
        </Button>
        <Button variant="secondary" className="h-12 justify-start gap-2" onClick={() => navigate('/profile')}>
          <Users className="h-4 w-4" /> Min profil
        </Button>
        {isAdmin && (
          <Button
            variant="outline"
            className="col-span-2 h-12 justify-between"
            onClick={() => navigate('/admin/leirskole')}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Leirskole-admin
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Neste vakt */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4 text-primary" /> {todayShifts.length ? 'I dag' : 'Neste vakt'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shiftsLoading ? (
            <Skeleton className="h-14" />
          ) : !nextShift ? (
            <p className="text-sm text-muted-foreground">
              {week.schedule_published_at ? 'Ingen kommende vakter.' : 'Vaktplanen er ikke publisert ennå.'}
            </p>
          ) : (
            <div className="rounded-2xl border bg-primary/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{nextShift.name}</p>
                <Badge className="tabular-nums">
                  {hhmm(nextShift.start_time)}–{hhmm(nextShift.end_time)}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dayLabel(nextShift.date)} · {Number(nextShift.duration_hours ?? 0).toFixed(1)}t
                {(nextShift.is_night || nextShift.crosses_midnight) && ' · nattvakt'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mine vakter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Mine vakter
          </CardTitle>
          <CardDescription>
            {myHours.toFixed(1)} timer denne uken · maks {maxDaily}t per dag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {shiftsLoading ? (
            <Skeleton className="h-16" />
          ) : shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {week.schedule_published_at ? 'Du har ingen vakter denne uken.' : 'Vaktplanen er ikke publisert ennå.'}
            </p>
          ) : (
            shifts.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  p.date === today ? 'border-primary/40 bg-primary/5' : 'bg-card/50'
                }`}
              >
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

      {/* Oppgaver */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Oppgaver fra admin
          </CardTitle>
          {myTasks.length > 0 && (
            <>
              <CardDescription>
                {doneTasks} av {myTasks.length} fullført
              </CardDescription>
              <Progress value={taskPct} className="mt-2 h-1.5" />
            </>
          )}
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

      {/* Teamet */}
      {(staff ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Ledere denne uken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(staff ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-full border bg-card/50 py-1 pl-1 pr-3">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={s.leader?.profile_image_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(s.leader?.name ?? '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{s.leader?.name ?? 'Ukjent'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hele vaktplanen */}
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
                <p className={`text-xs font-semibold uppercase tracking-wide ${date === today ? 'text-primary' : 'text-muted-foreground'}`}>
                  {dayLabel(date)}{date === today ? ' · i dag' : ''}
                </p>
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
