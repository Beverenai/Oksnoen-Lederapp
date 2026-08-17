import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Moon, Sparkles, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLeirskoleActivities,
  useLeirskoleActivityTypes,
  useLeirskoleSchedule,
  useLeirskoleWeekDays,
  useLeirskoleWeekPlan,
  useLeirskoleKitchenDays,
  useSetLeirskoleKitchenDay,
  type LeirskoleStaff,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import {
  runLeirskoleGenerate,
  type LeirskoleGenerateMode,
  type LeirskoleGenerateSummary,
} from '@/lib/leirskoleGenerateAll';
import { LeirskoleCellSheet, type CellTarget } from '@/components/admin/LeirskoleCellSheet';
import { LeirskoleSpecialDayTimeline } from '@/components/admin/LeirskoleSpecialDayTimeline';
import { LeirskolePostStaffPicker } from '@/components/admin/LeirskolePostStaffPicker';
import { trimDayHours } from '@/lib/leirskoleDayHours';

const MEALS = ['Frokost', 'Middag', 'Kvelds'];

type StaffRow = LeirskoleStaff & {
  leader: {
    id: string;
    name: string;
    profile_image_url?: string | null;
    leirskole_competencies: string[] | null;
  } | null;
};

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const SESSIONS = [
  { row: 1, label: 'Økt 1', session: 'formiddag' },
  { row: 2, label: 'Økt 2', session: 'ettermiddag' },
  { row: 3, label: 'Økt 3', session: 'kveld' },
];

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 21) {
    out.push(d.toLocaleDateString('sv-SE'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const firstName = (name: string) => name.split(' ')[0];

/** Hele uken i ett bord: økter, aktiviteter, ledere, måltider, kjøkken, natt og timer. */
export function LeirskoleWeekBoard({ week, staff }: { week: LeirskoleWeek; staff: StaffRow[] }) {
  const qc = useQueryClient();
  const { leader } = useAuth();
  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: cells } = useLeirskoleWeekPlan(week.id);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const { data: activities } = useLeirskoleActivities(week.id);
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: kitchenDays } = useLeirskoleKitchenDays(week.id);
  const setKitchenDay = useSetLeirskoleKitchenDay();
  const [target, setTarget] = useState<CellTarget | null>(null);
  const [summary, setSummary] = useState<LeirskoleGenerateSummary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  const specialDays = useMemo(() => {
    const map = new Map<string, string>();
    (weekDays ?? []).forEach((d) => {
      if (d.day_type !== 'normal') map.set(d.date, d.day_type);
    });
    return map;
  }, [weekDays]);

  const staffToLeader = useMemo(() => {
    const map = new Map<string, { id: string; name: string; competencies: string[] }>();
    staff.forEach((s) => {
      if (s.leader) {
        map.set(s.id, {
          id: s.leader.id,
          name: s.leader.name,
          competencies: s.leader.leirskole_competencies ?? [],
        });
      }
    });
    return map;
  }, [staff]);

  /** `${date}|${rowIndex}` og `post|${postId}` -> innhold i ukeplanen. */
  const planContent = useMemo(() => {
    const map = new Map<string, string>();
    (cells ?? []).forEach((c) => {
      const key = c.post_id ? `post|${c.post_id}` : c.row_index != null ? `${c.date}|${c.row_index}` : null;
      if (key) map.set(key, c.content ?? '');
    });
    return map;
  }, [cells]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, typeof posts>();
    (posts ?? []).forEach((p) => {
      map.set(p.date, [...(map.get(p.date) ?? []), p]);
    });
    return map;
  }, [posts]);

  /** `${date}|${session}` -> ledere på vakt. Session = formiddag/ettermiddag/kveld, eller postId for egne økter. */
  const dutyBySlot = useMemo(() => {
    const map = new Map<string, { id: string; name: string; competencies: string[] }[]>();
    (posts ?? []).forEach((p) => {
      const session = p.is_custom
        ? p.id
        : SESSIONS.find((s) => s.label.toLowerCase() === (p.name ?? '').trim().toLowerCase())?.session;
      if (!session) return;
      const list = map.get(`${p.date}|${session}`) ?? [];
      p.assignments.forEach((a) => {
        const l = staffToLeader.get(a.staff_id);
        if (l && !list.some((x) => x.id === l.id)) list.push(l);
      });
      map.set(`${p.date}|${session}`, list);
    });
    return map;
  }, [posts, staffToLeader]);

  const activityBySlot = useMemo(() => {
    const map = new Map<string, { leader_id: string; activity: string }[]>();
    (activities ?? []).forEach((a) => {
      const key = `${a.date}|${a.session}`;
      map.set(key, [...(map.get(key) ?? []), { leader_id: a.leader_id, activity: a.activity }]);
    });
    return map;
  }, [activities]);

  const leaderName = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => s.leader && map.set(s.leader.id, s.leader.name));
    return map;
  }, [staff]);

  const staffOptions = useMemo(
    () => staff.filter((s) => s.leader).map((s) => ({ staffId: s.id, name: s.leader!.name })),
    [staff],
  );

  const maxHours = Number(week.max_daily_hours ?? 8);

  /** Timer per leirskole_staff-id per dag — vises i bemanningsvelgerne. */
  const staffHoursByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    (posts ?? []).forEach((p) => {
      const day = map.get(p.date) ?? new Map<string, number>();
      p.assignments.forEach((a) => {
        day.set(a.staff_id, (day.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0));
      });
      map.set(p.date, day);
    });
    return map;
  }, [posts]);

  /** Timer per leder per dag, for å se om noen er langt fra 8t. */
  const hoursByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    (posts ?? []).forEach((p) => {
      const day = map.get(p.date) ?? new Map<string, number>();
      p.assignments.forEach((a) => {
        const l = staffToLeader.get(a.staff_id);
        if (!l) return;
        day.set(l.id, (day.get(l.id) ?? 0) + Number(p.duration_hours ?? 0));
      });
      map.set(p.date, day);
    });
    return map;
  }, [posts, staffToLeader]);

  const generate = useMutation({
    mutationFn: (mode: LeirskoleGenerateMode) =>
      runLeirskoleGenerate({
        weekId: week.id,
        startDate: week.start_date,
        endDate: week.end_date,
        mode,
        createdBy: leader?.id ?? null,
      }),
    onSuccess: (result) => {
      setSummary(result);
      ['leirskole-week-plan', 'leirskole-schedule', 'leirskole-activities', 'leirskole-activity-history', 'leirskole-my-shifts'].forEach(
        (key) => qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success('Uken er generert');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke generere uken'),
  });

  /** Rydd en dag: fjern automatiske vakter til ingen ligger over dagstaket. */
  const fixDay = useMutation({
    mutationFn: async (date: string) => {
      const day = staffHoursByDate.get(date) ?? new Map<string, number>();
      const over = [...day.entries()].filter(([, v]) => v > maxHours + 0.01);
      let count = 0;
      for (const [staffId] of over) {
        const removed = await trimDayHours({ weekId: week.id, date, staffId, maxHours });
        count += removed.length;
      }
      return count;
    },
    onSuccess: (count) => {
      ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-activities'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success(count ? `Fjernet ${count} vakter` : 'Ingen ulåste vakter å fjerne');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke rydde dagen'),
  });

  /** Radene for en vanlig dag: økt 1–3. Ankomst/avreise bruker kalenderkolonne. */
  const rowsFor = (date: string): (CellTarget | null)[] => {
    if (specialDays.has(date)) return SESSIONS.map(() => null);
    return SESSIONS.map((s) => ({
      date,
      session: s.session,
      rowIndex: s.row,
      label: s.label,
      dayType: 'normal' as const,
    }));
  };

  const cellContent = (t: CellTarget) =>
    planContent.get(t.postId ? `post|${t.postId}` : `${t.date}|${t.rowIndex}`) ?? '';

  const gridStyle = { gridTemplateColumns: `64px repeat(${dates.length}, minmax(0, 1fr))` };

  /** Aktiviteter i ukeplanen som ingen leder har fått ennå. */
  const missing = useMemo(() => {
    const out: { target: CellTarget; label: string; emoji: string | null }[] = [];
    dates.forEach((date) => {
      rowsFor(date).forEach((t) => {
        if (!t || !t.session) return;
        const lines = cellContent(t).split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) return;
        const slotActivities = activityBySlot.get(`${date}|${t.session}`) ?? [];
        (types ?? [])
          .filter((ty) => lines.some((l) => l.toLowerCase().includes(ty.label.toLowerCase())))
          .filter((ty) => !slotActivities.some((a) => a.activity === ty.key))
          .forEach((ty) => out.push({ target: t, label: ty.label, emoji: ty.emoji }));
      });
    });
    return out;
  }, [dates, activityBySlot, types, planContent, postsByDate, specialDays]);

  const missingByDay = useMemo(() => {
    const map = new Map<string, typeof missing>();
    missing.forEach((m) => map.set(m.target.date, [...(map.get(m.target.date) ?? []), m]));
    return map;
  }, [missing]);

  const LabelCell = ({ children }: { children: React.ReactNode }) => (
    <div className="sticky left-0 z-10 flex items-center bg-card px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );

  return (
    <div className="oks-ls-pill space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Hele uken
          </p>
          <p className="text-xs text-muted-foreground">
            Trykk på en rute for å endre aktiviteter eller hvem som tar dem.
          </p>
        </div>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button className="gap-2 rounded-full" disabled={generate.isPending}>
              <Wand2 className="h-4 w-4" />
              {generate.isPending ? 'Genererer…' : 'Generer uken'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1">
            {[
              { mode: 'all' as const, title: 'Generer alt', sub: 'Ukeplan + vaktplan + aktiviteter' },
              { mode: 'plan' as const, title: 'Tilfeldig ukeplan', sub: 'Fyll bare tomme ruter' },
              { mode: 'schedule' as const, title: 'Kun vaktplan + aktiviteter', sub: 'Behold ukeplanen som den er' },
            ].map((o) => (
              <button
                key={o.mode}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  generate.mutate(o.mode);
                }}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-muted"
              >
                <p className="text-sm font-semibold">{o.title}</p>
                <p className="text-xs text-muted-foreground">{o.sub}</p>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {summary && (
        <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">
          <p className="font-semibold">
            {summary.cellsFilled} ruter fylt · {summary.shifts} vakter · {summary.activityAssignments} aktiviteter fordelt
          </p>
          {summary.gaps.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" /> {summary.gaps.length} aktiviteter mangler leder
            </p>
          )}
        </div>
      )}

      {/* Mangler leder */}
      <div
        className={`rounded-2xl border px-3 py-2 text-xs ${
          missing.length
            ? 'border-amber-500/60 bg-amber-500/10'
            : 'border-emerald-500/50 bg-emerald-500/10'
        }`}
      >
        {missing.length === 0 ? (
          <p className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" /> Alle aktiviteter i ukeplanen har en leder
          </p>
        ) : (
          <>
            <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" /> {missing.length} aktiviteter mangler leder
            </p>
            <div className="mt-2 space-y-1.5">
              {dates
                .filter((date) => (missingByDay.get(date) ?? []).length > 0)
                .map((date) => {
                  const d = new Date(`${date}T12:00:00`);
                  return (
                    <div key={date} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-16 shrink-0 text-[11px] font-bold uppercase text-muted-foreground">
                        {WEEKDAYS[d.getDay()]} {d.getDate()}.
                      </span>
                      {(missingByDay.get(date) ?? []).map((m, i) => (
                        <button
                          key={`${m.target.label}-${m.label}-${i}`}
                          type="button"
                          onClick={() => setTarget(m.target)}
                          className="rounded-full border border-amber-500/50 bg-background/70 px-2 py-0.5 text-[11px] font-medium hover:bg-amber-500/20"
                        >
                          {m.emoji ?? '•'} {m.label}
                          <span className="ml-1 text-[10px] text-muted-foreground">{m.target.label}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>

      <div className="-mx-2 px-2">
        <div className="space-y-1.5">
          {/* Dagoverskrifter */}
          <div className="grid gap-1.5" style={gridStyle}>
            <div className="sticky left-0 z-10 bg-card" />
            {dates.map((date) => {
              const d = new Date(`${date}T12:00:00`);
              const special = specialDays.get(date);
              return (
                <div
                  key={date}
                  className={`rounded-xl px-2 py-1.5 text-center ${
                    special ? 'border border-dashed border-amber-500/60 bg-amber-500/15' : 'oks-ls-gradient'
                  }`}
                >
                  <p className={`text-xs font-bold ${special ? 'text-amber-700 dark:text-amber-200' : 'text-white'}`}>
                    {WEEKDAYS[d.getDay()]} {d.getDate()}.
                  </p>
                  {special && (
                    <p className="text-[10px] font-semibold uppercase text-amber-700/80 dark:text-amber-200/80">
                      {special === 'arrival' ? 'Ankomst' : 'Avreise'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Øktrader — ankomst/avreise vises som kalenderkolonne over alle tre radene */}
          <div className="grid gap-1.5" style={gridStyle}>
            {SESSIONS.map((s, rowIdx) => (
              <div key={`label-${s.row}`} style={{ gridColumn: 1, gridRow: rowIdx + 1 }} className="flex items-center">
                <LabelCell>{s.label}</LabelCell>
              </div>
            ))}
            {dates.map((date, dayIdx) =>
              specialDays.has(date) ? (
                <div
                  key={`cal-${date}`}
                  style={{ gridColumn: dayIdx + 2, gridRow: '1 / span 3' }}
                  className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-1.5"
                >
                  <LeirskoleSpecialDayTimeline
                    weekId={week.id}
                    date={date}
                    posts={(postsByDate.get(date) ?? [])
                      .filter((p) => p.is_custom)
                      .map((p) => ({
                        id: p.id,
                        name: p.name ?? '',
                        start_time: p.start_time,
                        end_time: p.end_time,
                        assignments: p.assignments ?? [],
                      }))}
                    staffOptions={staff
                      .filter((s) => s.leader)
                      .map((s) => ({ staffId: s.id, name: s.leader!.name }))}
                  />
                </div>
              ) : (
                SESSIONS.map((s, rowIdx) => {
                  const t = rowsFor(date)[rowIdx];
                  if (!t) return null;
                const content = cellContent(t);
                const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
                const slotActivities = t.session ? activityBySlot.get(`${date}|${t.session}`) ?? [] : [];
                const selectedTypes = (types ?? []).filter((ty) =>
                  lines.some((l) => l.toLowerCase().includes(ty.label.toLowerCase())),
                );
                const withLeader = selectedTypes.filter((ty) =>
                  slotActivities.some((a) => a.activity === ty.key),
                ).length;
                const tone =
                  lines.length === 0
                    ? 'border-border/60 bg-muted/25'
                    : withLeader >= selectedTypes.length && selectedTypes.length > 0
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-amber-500/50 bg-amber-500/10';
                return (
                  <button
                    key={`${date}-${s.row}`}
                    type="button"
                    style={{ gridColumn: dayIdx + 2, gridRow: rowIdx + 1 }}
                    onClick={() => setTarget(t)}
                    className={`rounded-xl border p-2 text-left transition-colors hover:brightness-105 ${tone}`}
                  >
                    {t.session === null && (
                      <p className="mb-1 truncate text-[10px] font-semibold uppercase text-muted-foreground">
                        {t.label}
                      </p>
                    )}
                    {lines.length === 0 && <p className="text-[11px] text-muted-foreground">Tom — trykk for å fylle</p>}
                    <div className="space-y-1">
                      {selectedTypes.map((ty) => {
                        const holder = slotActivities.find((a) => a.activity === ty.key);
                        return (
                          <div key={ty.key} className="flex items-center gap-1 text-[11px]">
                            <span>{ty.emoji ?? '•'}</span>
                            <span className="flex-1 truncate font-medium">{ty.label}</span>
                            <span
                              className={`shrink-0 truncate text-[10px] ${
                                holder ? 'font-semibold text-foreground' : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {holder ? firstName(leaderName.get(holder.leader_id) ?? '?') : 'ingen'}
                            </span>
                          </div>
                        );
                      })}
                      {selectedTypes.length === 0 &&
                        lines.map((l, i) => (
                          <p key={`${l}-${i}`} className="truncate text-[11px]">
                            {l}
                          </p>
                        ))}
                    </div>
                    {t.session && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(dutyBySlot.get(`${date}|${t.session}`) ?? []).length === 0 && (
                          <span className="text-[10px] text-muted-foreground">Ingen ledere</span>
                        )}
                        {(dutyBySlot.get(`${date}|${t.session}`) ?? []).map((l) => {
                          const act = slotActivities.find((a) => a.leader_id === l.id);
                          const ty = act ? (types ?? []).find((x) => x.key === act.activity) : null;
                          return (
                            <span
                              key={l.id}
                              title={ty ? `${l.name} – ${ty.label}` : `${l.name} – uten aktivitet`}
                              className={`truncate max-w-[6.5rem] rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                act
                                  ? 'bg-background/70 text-foreground'
                                  : 'border border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground'
                              }`}
                            >
                              {ty?.emoji ? `${ty.emoji} ` : ''}
                              {firstName(l.name)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
                })
              ),
            )}
          </div>

          {/* Timer */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>Timer</LabelCell>
            {dates.map((date) => {
              const day = hoursByDate.get(date) ?? new Map<string, number>();
              const values = [...day.values()];
              const max = Number(week.max_daily_hours ?? 8);
              const over = [...day.entries()].filter(([, v]) => v > max + 0.01);
              const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              return (
                <div
                  key={date}
                  className={`rounded-xl border p-2 text-[11px] ${
                    over.length ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border/60 bg-muted/25'
                  }`}
                >
                  <span className="font-bold tabular-nums">{avg.toFixed(1)}t</span>
                  <span className="text-muted-foreground"> snitt · {values.length} ledere</span>
                  {over.length > 0 && (
                    <>
                      <p className="font-semibold">{over.length} over {max}t</p>
                      <p className="text-[10px] leading-tight">
                        {over
                          .map(([id, v]) => `${firstName(leaderName.get(id) ?? '?')} ${v.toFixed(1)}t`)
                          .join(' · ')}
                      </p>
                      <button
                        type="button"
                        onClick={() => fixDay.mutate(date)}
                        disabled={fixDay.isPending}
                        className="mt-1 rounded-full border border-destructive/50 bg-background/70 px-2 py-0.5 text-[10px] font-semibold hover:bg-destructive/10"
                      >
                        Fiks timer
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LeirskoleCellSheet
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        weekId={week.id}
        target={target}
        content={target ? cellContent(target) : ''}
        types={types ?? []}
        onDuty={target?.session ? dutyBySlot.get(`${target.date}|${target.session}`) ?? [] : []}
        allStaff={staff
          .filter((s) => s.leader)
          .map((s) => ({
            id: s.leader!.id,
            name: s.leader!.name,
            competencies: s.leader!.leirskole_competencies ?? [],
          }))}
        assignments={target?.session ? activityBySlot.get(`${target.date}|${target.session}`) ?? [] : []}
        post={
          target?.postId
            ? (() => {
                const p = (posts ?? []).find((x) => x.id === target.postId);
                return p
                  ? {
                      id: p.id,
                      name: p.name ?? '',
                      start_time: p.start_time,
                      end_time: p.end_time,
                      assignments: p.assignments ?? [],
                    }
                  : null;
              })()
            : null
        }
        staffOptions={staff
          .filter((s) => s.leader)
          .map((s) => ({ staffId: s.id, leaderId: s.leader!.id, name: s.leader!.name }))}
      />
    </div>
  );
}
