import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, Moon, Settings, Megaphone, Check, Sun, Sparkles } from 'lucide-react';
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
import { competenceEmoji, competenceLabel } from '@/lib/leirskoleCompetencies';
import { sessionLabel } from '@/lib/leirskoleActivities';

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
};
const dayLabel = (d: string) => {
  const date = parse(d);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}. ${MONTHS[date.getMonth()]}`;
};
const shortDate = (d: string) => {
  const date = parse(d);
  return `${date.getDate()}. ${MONTHS[date.getMonth()]}`;
};
const hhmm = (t: string) => t.slice(0, 5);
const todayStr = () => new Date().toLocaleDateString('sv-SE');

export default function Leirskole() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const { data: isStaff } = useIsLeirskoleStaff(week?.id);
  const { data: myShifts, isLoading: shiftsLoading } = useMyLeirskoleShifts(week?.id);
  const { data: sessionInfo } = useLeirskoleSessionInfo(week?.id);
  const { data: myActivities } = useMyLeirskoleActivities(week?.id);
  const markInfoRead = useMarkLeirskoleInfoRead();
  const { data: myCompetencies, isLoading: compLoading } = useMyLeirskoleCompetencies();
  const [compOpen, setCompOpen] = useState(false);
  const compMissing = !compLoading && (myCompetencies ?? []).length === 0;

  // Første gang: be lederen legge inn kompetansen sin.
  useEffect(() => {
    if (compMissing && !!effectiveLeader?.id) setCompOpen(true);
  }, [compMissing, effectiveLeader?.id]);

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

  const myInfo = useMemo(
    () =>
      (sessionInfo ?? []).filter(
        (i: any) => i.assign_all || (i.assigned_leader_ids ?? []).includes(effectiveLeader?.id),
      ),
    [sessionInfo, effectiveLeader?.id],
  );

  const todayActivities = useMemo(
    () => (myActivities ?? []).filter((a) => a.date === today),
    [myActivities, today],
  );
  const nextActivity = useMemo(
    () => (myActivities ?? []).find((a) => a.date > today) ?? null,
    [myActivities, today],
  );

  if (weekLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
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
          <Button className="mt-4 rounded-full" onClick={() => navigate('/admin/leirskole')}>
            <Settings className="mr-2 h-4 w-4" /> Leirskole-admin
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-6 animate-fade-in">
      {/* Uke øverst */}
      <header className="oks-glass-card p-4">
        <span className="oks-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Leirskole
        </span>
        <h1 className="mt-2 text-[26px] font-heading font-bold leading-tight">{week.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {shortDate(week.start_date)} – {shortDate(week.end_date)}
          {!week.schedule_published_at && (
            <Badge variant="outline" className="rounded-full">Vaktplan ikke publisert</Badge>
          )}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="oks-pill px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{myHours.toFixed(1)}t</p>
            <p className="text-[11px] text-muted-foreground">Mine timer</p>
          </div>
          <div className="oks-pill px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{todayHours.toFixed(1)}/{maxDaily}t</p>
            <p className="text-[11px] text-muted-foreground">I dag</p>
          </div>
        </div>
      </header>

      {isStaff === false && !isAdmin && (
        <p className="oks-glass-card px-3.5 py-2.5 text-sm text-muted-foreground">
          Du er ikke satt opp på denne leirskoleuken ennå — du får vakter, oppgaver og chat når admin legger deg inn.
        </p>
      )}

      {/* Denne økten skal du */}
      {(todayActivities.length > 0 || myInfo.length > 0 || nextActivity) && (
        <section className="oks-glass-card border-primary/30 p-4">
          <h2 className="flex items-center gap-2 text-base font-heading font-bold">
            <Megaphone className="h-4 w-4 text-primary" /> Denne økten skal du
          </h2>

          <div className="mt-3 space-y-2">
            {todayActivities.map((a) => (
              <div key={a.id} className="oks-pill flex items-center gap-2 px-3 py-2.5">
                <span className="text-lg" aria-hidden>{competenceEmoji(a.activity)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{competenceLabel(a.activity)}</p>
                  <p className="text-[11px] text-muted-foreground">{sessionLabel(a.session)}{a.note ? ` · ${a.note}` : ''}</p>
                </div>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            ))}

            {todayActivities.length === 0 && nextActivity && (
              <div className="oks-pill flex items-center gap-2 px-3 py-2.5">
                <span className="text-lg" aria-hidden>{competenceEmoji(nextActivity.activity)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{competenceLabel(nextActivity.activity)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {dayLabel(nextActivity.date)} · {sessionLabel(nextActivity.session)}
                  </p>
                </div>
              </div>
            )}

            {myInfo.map((i: any) => (
              <div key={i.id} className="oks-pill px-3 py-2.5">
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
        </section>
      )}

      {/* Neste vakt */}
      <section className="oks-glass-card p-4">
        <h2 className="flex items-center gap-2 text-base font-heading font-bold">
          <Sun className="h-4 w-4 text-primary" /> {todayShifts.length ? 'I dag' : 'Neste vakt'}
        </h2>
        <div className="mt-3">
          {shiftsLoading ? (
            <Skeleton className="h-14 rounded-2xl" />
          ) : !nextShift ? (
            <p className="text-sm text-muted-foreground">
              {week.schedule_published_at ? 'Ingen kommende vakter.' : 'Vaktplanen er ikke publisert ennå.'}
            </p>
          ) : (
            <div className="oks-pill px-3 py-2.5">
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
        </div>
      </section>

      {/* Mine vakter */}
      <section className="oks-glass-card p-4">
        <h2 className="flex items-center gap-2 text-base font-heading font-bold">
          <Clock className="h-4 w-4 text-primary" /> Mine vakter
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {myHours.toFixed(1)} timer denne uken · maks {maxDaily}t per dag
        </p>
        <div className="mt-3 space-y-2">
          {shiftsLoading ? (
            <Skeleton className="h-16 rounded-2xl" />
          ) : shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {week.schedule_published_at ? 'Du har ingen vakter denne uken.' : 'Vaktplanen er ikke publisert ennå.'}
            </p>
          ) : (
            shifts.map((p) => (
              <div
                key={p.id}
                className={`oks-pill flex items-center justify-between px-3 py-2 ${
                  p.date === today ? 'ring-1 ring-primary/40' : ''
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
        </div>
      </section>

      {effectiveLeader?.id && (
        <LeirskoleCompetenceSheet
          open={compOpen}
          onOpenChange={setCompOpen}
          leaderId={effectiveLeader.id}
          leaderName={effectiveLeader.name}
          current={myCompetencies ?? []}
        />
      )}
    </div>
  );
}
