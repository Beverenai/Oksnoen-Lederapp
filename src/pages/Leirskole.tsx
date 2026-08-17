import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, Moon, Settings, Megaphone, Check } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useIsLeirskoleStaff,
  useLeirskoleSessionInfo,
  useMarkLeirskoleInfoRead,
  useMyLeirskoleActivities,
  useMyLeirskoleShifts,
  useMyLeirskoleCompetencies,
} from '@/hooks/useLeirskole';
import { LeirskoleCompetenceSheet } from '@/components/leirskole/LeirskoleCompetenceSheet';
import { activityEmoji, activityLabel, sessionLabel } from '@/lib/leirskoleActivities';
import { dayLabel, shortDate, hhmm, todayStr } from '@/lib/leirskoleDates';

export default function Leirskole() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const { data: isStaff } = useIsLeirskoleStaff(week?.id);
  const { data: myShifts, isLoading: shiftsLoading } = useMyLeirskoleShifts(week?.id);
  const { data: sessionInfo } = useLeirskoleSessionInfo(week?.id);
  const { data: myActivities } = useMyLeirskoleActivities(week?.id);
  const markInfoRead = useMarkLeirskoleInfoRead();
  const { data: myCompetencies } = useMyLeirskoleCompetencies();
  const [compOpen, setCompOpen] = useState(false);

  // Førstegangs-oppsett: alle har alle kompetanser som utgangspunkt,
  // men må bekrefte/velge selv første gang de åpner leirskole.
  const needsCompetenceSetup =
    !!effectiveLeader?.id && !!myCompetencies && !myCompetencies.confirmedAt;

  useEffect(() => {
    if (needsCompetenceSetup) setCompOpen(true);
  }, [needsCompetenceSetup]);

  const firstName = (effectiveLeader?.name ?? '').split(' ')[0] || 'leder';
  const today = todayStr();

  const myInfo = useMemo(
    () =>
      (sessionInfo ?? []).filter(
        (info) => info.assign_all || (info.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
      ),
    [sessionInfo, effectiveLeader?.id],
  );

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
    return map;
  }, [shifts]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, typeof shifts>();
    shifts.forEach((p) => map.set(p.date, [...(map.get(p.date) ?? []), p]));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  const todayActivities = useMemo(
    () => (myActivities ?? []).filter((a) => a.date >= today).slice(0, 3),
    [myActivities, today],
  );

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
      {/* Uke */}
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

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { v: `${myHours.toFixed(1)}t`, l: 'Min uke' },
            { v: `${todayHours.toFixed(1)}/${maxDaily}t`, l: 'I dag' },
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
      {(todayActivities.length > 0 || myInfo.length > 0) && (
        <div className="oks-ls-pill p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-primary" /> Denne økten skal du
          </p>
          <div className="space-y-2">
            {todayActivities.map((a) => (
              <div key={a.id} className="rounded-2xl bg-primary/12 p-3">
                <p className="text-sm font-semibold">
                  {activityEmoji(a.activity)} {activityLabel(a.activity)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dayLabel(a.date)} · {sessionLabel(a.session)}
                  {a.date === today ? ' · i dag' : ''}
                </p>
                {a.note && <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>}
              </div>
            ))}
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
              const hours = hoursByDay.get(date) ?? 0;
              return (
                <div key={date}>
                  <div className="mb-1 flex items-center justify-between">
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        date === today ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {dayLabel(date)}
                      {date === today ? ' · i dag' : ''}
                    </p>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {hours.toFixed(1)}/{maxDaily}t
                    </span>
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
                          {(p.is_night || p.crosses_midnight) && (
                            <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
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

      {effectiveLeader?.id && (
        <LeirskoleCompetenceSheet
          open={compOpen}
          onOpenChange={setCompOpen}
          leaderId={effectiveLeader.id}
          leaderName={effectiveLeader.name}
          current={myCompetencies ? [...myCompetencies] : []}
          required={needsCompetenceSetup}
          confirm
        />
      )}
    </div>
  );
}
