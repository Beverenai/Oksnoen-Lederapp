import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Coffee, CalendarDays, Clock, Moon, Settings, Megaphone, Check, Users, Sunrise, Sunset } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useLeirskoleSchedule,
  useLeirskoleStaff,
  useIsLeirskoleStaff,
  useLeirskoleSessionInfo,
  useMarkLeirskoleInfoRead,
  useMyLeirskoleActivities,
  useLeirskoleActivityTypes,
  useMyLeirskoleShifts,
  useMyLeirskoleCompetencies,
} from '@/hooks/useLeirskole';
import { LeirskoleCompetenceSheet } from '@/components/leirskole/LeirskoleCompetenceSheet';
import { LeaderAvatarStack, type AvatarPerson } from '@/components/leirskole/LeaderAvatarStack';
import { LeirskoleColleagueSheet } from '@/components/leirskole/LeirskoleColleagueSheet';
import { activityEmoji, activityLabel, sessionLabel } from '@/lib/leirskoleActivities';
import { dayLabel, shortDate, hhmm, todayStr } from '@/lib/leirskoleDates';

/** Formiddag/ettermiddag skal se tydelig forskjellige ut. */
const SESSION_STYLE = {
  formiddag: {
    icon: Sunrise,
    label: 'Formiddag',
    time: '11–14',
    card: 'border-amber-500/40 bg-amber-500/10',
    chip: 'bg-amber-500/20 text-amber-700 dark:text-amber-200',
    bar: 'bg-amber-500',
  },
  ettermiddag: {
    icon: Sunset,
    label: '2. økt',
    time: '16–19',
    card: 'border-sky-500/40 bg-sky-500/10',
    chip: 'bg-sky-500/20 text-sky-700 dark:text-sky-200',
    bar: 'bg-sky-500',
  },
  kveld: {
    icon: Sunset,
    label: '3. økt',
    time: '20–21:30',
    card: 'border-violet-500/40 bg-violet-500/10',
    chip: 'bg-violet-500/20 text-violet-700 dark:text-violet-200',
    bar: 'bg-violet-500',
  },
} as const;

const sessionStyle = (key: string) =>
  SESSION_STYLE[key as keyof typeof SESSION_STYLE] ?? SESSION_STYLE.formiddag;

/** Vakt før 15:00 = 1. økt, før 20:00 = 2. økt, ellers 3. økt. */
const sessionForShift = (startTime: string) => {
  const h = Number(startTime.slice(0, 2));
  return h < 15 ? 'formiddag' : h < 20 ? 'ettermiddag' : 'kveld';
};

/** Alle datoene i uken, slik at fridager også vises. */
function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function Leirskole() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const { data: isStaff } = useIsLeirskoleStaff(week?.id);
  const { data: myShifts, isLoading: shiftsLoading } = useMyLeirskoleShifts(week?.id);
  const { data: sessionInfo } = useLeirskoleSessionInfo(week?.id);
  const { data: myActivities } = useMyLeirskoleActivities(week?.id);
  const { data: activityTypes } = useLeirskoleActivityTypes(true);
  const markInfoRead = useMarkLeirskoleInfoRead();
  const { data: myCompetencies } = useMyLeirskoleCompetencies();
  const { data: weekPosts } = useLeirskoleSchedule(week?.id);
  const { data: weekStaff } = useLeirskoleStaff(week?.id);
  const [compOpen, setCompOpen] = useState(false);
  const [colleagueId, setColleagueId] = useState<string | null>(null);

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
  const todayHours = todayShifts.reduce((s, p) => s + Number(p.duration_hours ?? 0), 0);
  const maxDaily = Number(week?.max_daily_hours ?? 8);

  const nowTime = useMemo(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }, []);

  /** Aktiv eller neste vakt (i dag eller senere). */
  const nextShift = useMemo(() => {
    const sorted = [...shifts].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    return (
      sorted.find(
        (p) => p.date > today || (p.date === today && (p.start_time >= nowTime || p.end_time > nowTime)),
      ) ?? null
    );
  }, [shifts, today, nowTime]);

  const nextShiftSession = useMemo(
    () => (nextShift ? sessionForShift(nextShift.start_time) : null),
    [nextShift],
  );

  /** Aktiviteten som hører til neste vakt. */
  const nextShiftActivity = useMemo(() => {
    if (!nextShift || !nextShiftSession) return null;
    return (
      (myActivities ?? []).find((a) => a.date === nextShift.date && a.session === nextShiftSession) ?? null
    );
  }, [nextShift, nextShiftSession, myActivities]);

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

  /** Hele uken dag for dag — jobbdager og fridager. */
  const weekDays = useMemo(() => {
    const byDay = new Map(shiftsByDay);
    return datesBetween(week?.start_date ?? today, week?.end_date ?? today).map((date) => ({
      date,
      dayShifts: byDay.get(date) ?? [],
    }));
  }, [shiftsByDay, week?.start_date, week?.end_date, today]);

  /** staff_id → leder (navn + bilde) for hele uken. */
  const staffPeople = useMemo(() => {
    const map = new Map<string, AvatarPerson>();
    (weekStaff ?? []).forEach((s) => {
      if (s.leader) map.set(s.id, { id: s.id, name: s.leader.name, imageUrl: s.leader.profile_image_url });
    });
    return map;
  }, [weekStaff]);

  const myStaffId = useMemo(
    () => (weekStaff ?? []).find((s) => s.leader_id === effectiveLeader?.id)?.id ?? null,
    [weekStaff, effectiveLeader?.id],
  );

  /** Kollegaer på min neste vakt. */
  const nextShiftCrew = useMemo(() => {
    if (!nextShift) return [] as AvatarPerson[];
    const post = (weekPosts ?? []).find((p) => p.id === nextShift.id);
    if (!post) return [];
    return post.assignments
      .filter((a) => a.staff_id !== myStaffId)
      .map((a) => staffPeople.get(a.staff_id))
      .filter(Boolean) as AvatarPerson[];
  }, [nextShift, weekPosts, staffPeople, myStaffId]);

  /** Alle som jobber i dag, sortert etter første vakt. */
  const onDutyToday = useMemo(() => {
    const first = new Map<string, string>();
    (weekPosts ?? [])
      .filter((p) => p.date === today)
      .forEach((p) => {
        p.assignments.forEach((a) => {
          const cur = first.get(a.staff_id);
          if (!cur || p.start_time < cur) first.set(a.staff_id, p.start_time);
        });
      });
    return [...first.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([staffId]) => staffPeople.get(staffId))
      .filter(Boolean) as AvatarPerson[];
  }, [weekPosts, today, staffPeople]);

  const colleagueShifts = useMemo(() => {
    if (!colleagueId) return [];
    return (weekPosts ?? [])
      .filter((p) => p.assignments.some((a) => a.staff_id === colleagueId))
      .map((p) => ({
        id: p.id,
        date: p.date,
        name: p.name,
        start_time: p.start_time,
        end_time: p.end_time,
        duration_hours: Number(p.duration_hours ?? 0),
        is_night: p.is_night,
        crosses_midnight: p.crosses_midnight,
      }));
  }, [colleagueId, weekPosts]);

  const colleague = colleagueId ? staffPeople.get(colleagueId) ?? null : null;

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
      <div className="oks-ls-gradient overflow-hidden rounded-3xl p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Leirskole</p>
            <h1 className="mt-0.5 truncate text-2xl font-heading font-bold leading-tight">{week.name}</h1>
            <p className="mt-0.5 text-sm text-white/85">
              {shortDate(week.start_date)} – {shortDate(week.end_date)} · Hei {firstName}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
            {week.schedule_published_at ? 'Publisert' : 'Utkast'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { v: `${myHours.toFixed(1)}t`, l: 'Min uke' },
            { v: `${todayHours.toFixed(1)}/${maxDaily}t`, l: 'I dag' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/15 px-3 py-2">
              <p className="text-lg font-bold tabular-nums">{s.v}</p>
              <p className="text-[11px] text-white/80">{s.l}</p>
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
      {(nextShift || myInfo.length > 0) && (
        <div className="oks-ls-pill p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-primary" /> Denne økten skal du
          </p>
          <div className="space-y-2">
            {nextShift ? (
              (() => {
                const sessionKey = nextShiftSession!;
                const s = sessionStyle(sessionKey);
                const Icon = s.icon;
                return nextShiftActivity ? (
                  <div
                    key={nextShiftActivity.id}
                    className={`relative overflow-hidden rounded-2xl border p-3 pl-4 ${s.card}`}
                  >
                    <span className={`absolute left-0 top-0 h-full w-1.5 ${s.bar}`} />
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${s.chip}`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {sessionLabel(sessionKey)}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {s.time}
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-heading font-bold leading-tight">
                      {activityEmoji(nextShiftActivity.activity, activityTypes ?? [])} {activityLabel(nextShiftActivity.activity, activityTypes ?? [])}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayLabel(nextShiftActivity.date)}
                      {nextShiftActivity.date === today ? ' · i dag' : ''}
                    </p>
                    {nextShiftActivity.note && (
                      <p className="mt-1 text-xs text-muted-foreground">{nextShiftActivity.note}</p>
                    )}
                  </div>
                ) : (
                  <div className={`relative overflow-hidden rounded-2xl border border-dashed p-3 pl-4 ${s.card}`}>
                    <span className={`absolute left-0 top-0 h-full w-1.5 ${s.bar}`} />
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${s.chip}`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {sessionLabel(sessionKey)}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {s.time}
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-heading font-bold leading-tight">Fri</p>
                    <p className="text-xs text-muted-foreground">
                      {dayLabel(nextShift.date)}
                      {nextShift.date === today ? ' · i dag' : ' · neste'} · ingen aktivitet tildelt
                    </p>
                  </div>
                );
              })()
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-muted/30 p-3 pl-4">
                <span className="absolute left-0 top-0 h-full w-1.5 bg-muted-foreground/30" />
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Coffee className="h-3.5 w-3.5" /> Fri
                  </span>
                </div>
                <p className="mt-2 text-xl font-heading font-bold leading-tight">Ingen vakter nå</p>
                <p className="text-xs text-muted-foreground">Sjekk ukeplanen nedenfor for neste vakt.</p>
              </div>
            )}
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
            {nextShiftActivity && (
              <div
                className={`mt-2.5 flex items-center gap-2 rounded-2xl border px-3 py-2 ${sessionStyle(nextShiftActivity.session).card}`}
              >
                <span className="text-lg">{activityEmoji(nextShiftActivity.activity, activityTypes ?? [])}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{activityLabel(nextShiftActivity.activity, activityTypes ?? [])}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Din aktivitet · {sessionLabel(nextShiftActivity.session)}
                  </p>
                </div>
              </div>
            )}
            {nextShiftCrew.length > 0 && (
              <div className="mt-2.5 border-t border-border/50 pt-2.5">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Du jobber med
                </p>
                <LeaderAvatarStack
                  people={nextShiftCrew}
                  withNames
                  onSelect={(person) => setColleagueId(person.id)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hvem jobber i dag */}
      {onDutyToday.length > 0 && (
        <div className="oks-ls-pill p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Hvem jobber i dag
          </p>
          <LeaderAvatarStack
            people={onDutyToday}
            withNames
            onSelect={(person) => setColleagueId(person.id)}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">Trykk på en leder for å se vaktene deres.</p>
        </div>
      )}

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
          <div className="space-y-2.5">
            {weekDays.map(({ date, dayShifts }) => {
              const hours = hoursByDay.get(date) ?? 0;
              const isToday = date === today;
              const works = dayShifts.length > 0;
              return (
                <div
                  key={date}
                  className={`relative overflow-hidden rounded-2xl border pl-4 pr-3 py-2.5 ${
                    works
                      ? isToday
                        ? 'border-primary bg-primary/12 shadow-sm'
                        : 'border-primary/30 bg-primary/[0.06]'
                      : 'border-dashed border-border/60 bg-transparent'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-1.5 ${
                      works ? (isToday ? 'bg-primary' : 'bg-primary/50') : 'bg-transparent'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-bold ${
                        works ? (isToday ? 'text-primary' : '') : 'text-muted-foreground/70 font-medium'
                      }`}
                    >
                      {dayLabel(date)}
                      {isToday && <span className="ml-1.5 text-[11px] font-semibold uppercase">i dag</span>}
                    </p>
                    {works ? (
                      <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                        {hours.toFixed(1)}/{maxDaily}t
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Fri
                      </span>
                    )}
                  </div>
                  {works && (
                    <div className="mt-2 space-y-1.5">
                      {dayShifts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl bg-background/70 px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm font-medium">{p.name}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            {(p.is_night || p.crosses_midnight) && (
                              <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="text-xs font-bold tabular-nums">
                              {hhmm(p.start_time)}–{hhmm(p.end_time)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {colleague && (
        <LeirskoleColleagueSheet
          open={!!colleague}
          onOpenChange={(v) => !v && setColleagueId(null)}
          name={colleague.name}
          imageUrl={colleague.imageUrl}
          shifts={colleagueShifts}
          weekDates={weekDays.map((d) => d.date)}
        />
      )}

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
