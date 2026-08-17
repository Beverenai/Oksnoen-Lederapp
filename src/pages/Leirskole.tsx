import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays, MessageCircle, ClipboardList, Clock, Moon, Users, Settings,
  ChevronRight, Megaphone, Check, Award, Pencil,
} from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useIsLeirskoleStaff,
  useLeirskoleSessionInfo,
  useLeirskoleStaff,
  useLeirskoleTasks,
  useMarkLeirskoleInfoRead,
  useMyLeirskoleShifts,
  useMyLeirskoleCompetencies,
} from '@/hooks/useLeirskole';
import { LeirskoleCompetenceSheet } from '@/components/leirskole/LeirskoleCompetenceSheet';
import { competenceEmoji, competenceLabel } from '@/lib/leirskoleCompetencies';
import { dayLabel, shortDate, hhmm, todayStr } from '@/lib/leirskoleDates';

export default function Leirskole() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const { data: isStaff } = useIsLeirskoleStaff(week?.id);
  const { data: myShifts, isLoading: shiftsLoading } = useMyLeirskoleShifts(week?.id);
  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: tasks } = useLeirskoleTasks(week?.id);
  const { data: sessionInfo } = useLeirskoleSessionInfo(week?.id);
  const markInfoRead = useMarkLeirskoleInfoRead();
  const { data: myCompetencies, isLoading: compLoading } = useMyLeirskoleCompetencies();
  const [compOpen, setCompOpen] = useState(false);
  const compMissing = !compLoading && (myCompetencies ?? []).length === 0;

  // Første gang: be lederen legge inn kompetansen sin.
  useEffect(() => {
    if (compMissing && !!effectiveLeader?.id) setCompOpen(true);
  }, [compMissing, effectiveLeader?.id]);

  const firstName = (effectiveLeader?.name ?? '').split(' ')[0] || 'leder';

  const myInfo = useMemo(
    () =>
      (sessionInfo ?? []).filter(
        (info) => info.assign_all || (info.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
      ),
    [sessionInfo, effectiveLeader?.id],
  );

  const today = todayStr();
  const shifts = useMemo(() => myShifts ?? [], [myShifts]);
  const myHours = useMemo(
    () => shifts.reduce((sum, p) => sum + Number(p.duration_hours ?? 0), 0),
    [shifts],
  );
  const todayShifts = shifts.filter((p) => p.date === today);
  const upcoming = shifts.filter((p) => p.date > today);
  const nextShift = todayShifts[0] ?? upcoming[0] ?? null;
  const todayHours = todayShifts.reduce((s, p) => s + Number(p.duration_hours ?? 0), 0);
  const maxDaily = Number(week?.max_daily_hours ?? 8);

  const hoursByDay = useMemo(() => {
    const map = new Map<string, number>();
    shifts.forEach((p) => map.set(p.date, (map.get(p.date) ?? 0) + Number(p.duration_hours ?? 0)));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, typeof shifts>();
    shifts.forEach((p) => map.set(p.date, [...(map.get(p.date) ?? []), p]));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  const myTasks = (tasks ?? []).filter(
    (t) => t.assign_all || (t.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
  );
  const openTasks = myTasks.filter((t) => !t.completedByMe).length;

  if (weekLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (!week) {
    return (
      <div className="py-16 text-center animate-fade-in">
        <CalendarDays className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-heading font-bold">Ingen aktiv leirskoleuke</h1>
        <p className="mt-1 text-sm text-muted-foreground">Uken starter automatisk når datoen kommer.</p>
        {isAdmin && (
          <Button className="mt-4" onClick={() => navigate('/admin/leirskole')}>
            <Settings className="mr-2 h-4 w-4" /> Leirskole-admin
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in pb-6">
      {/* Ukeheader */}
      <div className="oks-ls-pill overflow-hidden p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Leirskole</p>
            <h1 className="mt-0.5 truncate text-2xl font-heading font-bold leading-tight">{week.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {shortDate(week.start_date)} – {shortDate(week.end_date)} · Hei {firstName}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
            {week.schedule_published_at ? 'Publisert' : 'Utkast'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { v: `${myHours.toFixed(1)}t`, l: 'Min uke' },
            { v: `${todayHours.toFixed(1)}/${maxDaily}t`, l: 'I dag' },
            { v: `${(staff ?? []).length}`, l: 'Ledere' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-muted/40 px-3 py-2">
              <p className="text-lg font-bold tabular-nums">{s.v}</p>
              <p className="text-[11px] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {isStaff === false && !isAdmin && (
        <p className="oks-ls-pill px-4 py-3 text-sm text-muted-foreground">
          Du er ikke satt opp på denne leirskoleuken ennå — du får vakter, oppgaver og chat når admin legger deg inn.
        </p>
      )}

      {/* Denne økten skal du */}
      {myInfo.length > 0 && (
        <div className="oks-ls-pill p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-primary" /> Denne økten skal du
          </p>
          <div className="space-y-2">
            {myInfo.map((i) => (
              <div key={i.id} className="rounded-2xl bg-muted/40 p-3">
                <p className="text-sm font-semibold">{i.title}</p>
                {i.body && <p className="mt-0.5 text-xs text-muted-foreground">{i.body}</p>}
                {(i.items ?? []).length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {(i.items as string[]).map((it, idx) => (
                      <li key={idx} className="flex gap-1.5 text-sm">
                        <span className="text-primary">•</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  size="sm"
                  variant={i.readByMe ? 'secondary' : 'default'}
                  className="mt-2 gap-1.5 rounded-full"
                  onClick={() => markInfoRead.mutate({ infoId: i.id, read: !i.readByMe })}
                >
                  <Check className="h-3.5 w-3.5" /> {i.readByMe ? 'Lest' : 'Marker som lest'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neste vakt */}
      <div className="oks-ls-pill p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" /> {todayShifts.length ? 'Neste vakt i dag' : 'Neste vakt'}
        </p>
        {shiftsLoading ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : !nextShift ? (
          <p className="text-sm text-muted-foreground">
            {week.schedule_published_at ? 'Ingen kommende vakter.' : 'Vaktplanen er ikke publisert ennå.'}
          </p>
        ) : (
          <div className="rounded-2xl bg-primary/12 p-3">
            <p className="text-3xl font-heading font-bold tabular-nums">
              {hhmm(nextShift.start_time)}–{hhmm(nextShift.end_time)}
            </p>
            <p className="mt-1 truncate text-sm font-medium">{nextShift.name}</p>
            <p className="text-xs text-muted-foreground">
              {dayLabel(nextShift.date)} · {Number(nextShift.duration_hours ?? 0).toFixed(1)}t
              {(nextShift.is_night || nextShift.crosses_midnight) && ' · nattevakt'}
            </p>
          </div>
        )}
      </div>

      {/* Mine vakter */}
      <div className="oks-ls-pill p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> Mine vakter
          </p>
          <span className="text-[11px] text-muted-foreground">maks {maxDaily}t/dag</span>
        </div>
        {shiftsLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {week.schedule_published_at ? 'Du har ingen vakter denne uken.' : 'Vaktplanen er ikke publisert ennå.'}
          </p>
        ) : (
          <div className="space-y-3">
            {shiftsByDay.map(([date, dayShifts]) => {
              const hours = hoursByDay.find(([d]) => d === date)?.[1] ?? 0;
              return (
                <div key={date}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${date === today ? 'text-primary' : 'text-muted-foreground'}`}>
                      {dayLabel(date)}{date === today ? ' · i dag' : ''}
                    </p>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{hours.toFixed(1)}/{maxDaily}t</span>
                  </div>
                  <div className="space-y-1.5">
                    {dayShifts.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between rounded-2xl px-3 py-2 ${
                          date === today ? 'bg-primary/12' : 'bg-muted/40'
                        }`}
                      >
                        <p className="min-w-0 truncate text-sm font-medium">{p.name}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          {(p.is_night || p.crosses_midnight) && <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="text-xs font-semibold tabular-nums">
                            {hhmm(p.start_time)}–{hhmm(p.end_time)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Min kompetanse */}
      <button
        onClick={() => setCompOpen(true)}
        className={`oks-ls-pill flex w-full items-center justify-between gap-3 p-4 text-left ${
          compMissing ? 'ring-1 ring-destructive/50' : ''
        }`}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Award className="h-4 w-4 text-primary" /> Min kompetanse
          </p>
          {compMissing ? (
            <p className="mt-1 text-xs text-muted-foreground">Legg inn hva du kan ha ansvar for</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(myCompetencies ?? []).map((c) => (
                <span key={c} className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium">
                  {competenceEmoji(c)} {competenceLabel(c)}
                </span>
              ))}
            </div>
          )}
        </div>
        <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Snarveier */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { to: '/leirskole/vaktplan', icon: CalendarDays, label: 'Vaktplan' },
          { to: '/leirskole/oppgaver', icon: ClipboardList, label: 'Oppgaver', badge: openTasks || undefined },
          { to: '/leaders', icon: Users, label: 'Ledere' },
          { to: '/chat', icon: MessageCircle, label: 'Lederhuset' },
        ].map((s) => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="oks-ls-pill flex items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <s.icon className="h-4 w-4 text-primary" /> {s.label}
            </span>
            {s.badge ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                {s.badge}
              </span>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin/leirskole')}
            className="oks-ls-pill col-span-2 flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4 text-primary" /> Leirskole-admin
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {effectiveLeader?.id && (
        <LeirskoleCompetenceSheet
          open={compOpen}
          onOpenChange={setCompOpen}
          leaderId={effectiveLeader.id}
          current={myCompetencies ?? []}
          required={compMissing}
        />
      )}
    </div>
  );
}
