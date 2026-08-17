import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, ChefHat, Moon, Sparkles, Utensils, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLeirskoleActivities,
  useLeirskoleActivityTypes,
  useLeirskoleKitchenDays,
  useLeirskoleSchedule,
  useLeirskoleWeekDays,
  useLeirskoleWeekPlan,
  type LeirskoleStaff,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import { hhmm } from '@/lib/leirskoleDates';
import {
  runLeirskoleGenerate,
  type LeirskoleGenerateMode,
  type LeirskoleGenerateSummary,
} from '@/lib/leirskoleGenerateAll';
import { LeirskoleCellSheet, type CellTarget } from '@/components/admin/LeirskoleCellSheet';

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
  const { data: kitchen } = useLeirskoleKitchenDays(week.id);
  const { data: activities } = useLeirskoleActivities(week.id);
  const { data: types } = useLeirskoleActivityTypes(true);
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

  /** `${date}|${session}` -> ledere på vakt. */
  const dutyBySlot = useMemo(() => {
    const map = new Map<string, { id: string; name: string; competencies: string[] }[]>();
    (posts ?? []).forEach((p) => {
      const name = (p.name ?? '').trim().toLowerCase();
      const session = SESSIONS.find((s) => s.label.toLowerCase() === name)?.session;
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

  const kitchenByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    (kitchen ?? []).forEach((k) => {
      const name = staffToLeader.get(k.staff_id)?.name;
      if (!name) return;
      map.set(k.date, [...(map.get(k.date) ?? []), name]);
    });
    return map;
  }, [kitchen, staffToLeader]);

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

  /** Radene for en dag: økt 1–3, eller dagens egne økter på ankomst/avreise. */
  const rowsFor = (date: string): (CellTarget | null)[] => {
    const dayType = specialDays.get(date);
    if (dayType) {
      const custom = (postsByDate.get(date) ?? [])
        .filter((p) => p.is_custom)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      return SESSIONS.map((_, i) => {
        const p = custom[i];
        if (!p) return null;
        return {
          date,
          session: p.id,
          rowIndex: null,
          postId: p.id,
          label: `${p.name} ${hhmm(p.start_time)}–${hhmm(p.end_time)}`,
          dayType,
        };
      });
    }
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

  const gridStyle = { gridTemplateColumns: `88px repeat(${dates.length}, minmax(150px, 1fr))` };

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

      <div className="-mx-2 overflow-x-auto px-2">
        <div className="min-w-max space-y-1.5">
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

          {/* Øktrader */}
          {SESSIONS.map((s, rowIdx) => (
            <div key={s.row} className="grid gap-1.5" style={gridStyle}>
              <LabelCell>{s.label}</LabelCell>
              {dates.map((date) => {
                const t = rowsFor(date)[rowIdx];
                if (!t) {
                  return (
                    <div key={date} className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      —
                    </div>
                  );
                }
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
                    key={date}
                    type="button"
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
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {(dutyBySlot.get(`${date}|${t.session}`) ?? []).length} på vakt
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Måltider */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>
              <Utensils className="mr-1 h-3 w-3" /> Måltid
            </LabelCell>
            {dates.map((date) => {
              const meals = (postsByDate.get(date) ?? []).filter((p) => p.post_type === 'meal');
              return (
                <div key={date} className="space-y-1 rounded-xl border border-border/60 bg-muted/25 p-2">
                  {meals.length === 0 && <p className="text-[11px] text-muted-foreground">—</p>}
                  {meals.map((p) => (
                    <div key={p.id} className="text-[11px]">
                      <span className="font-semibold">{p.name}</span>{' '}
                      <span className="text-muted-foreground">
                        {p.assignments
                          .map((a) => firstName(staffToLeader.get(a.staff_id)?.name ?? '?'))
                          .join(', ') || 'ingen'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Kjøkken */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>
              <ChefHat className="mr-1 h-3 w-3" /> Kjøkken
            </LabelCell>
            {dates.map((date) => {
              const names = kitchenByDate.get(date) ?? [];
              return (
                <div
                  key={date}
                  className={`rounded-xl border p-2 text-[11px] ${
                    names.length ? 'border-primary/40 bg-primary/10 font-semibold' : 'border-border/60 bg-muted/25 text-muted-foreground'
                  }`}
                >
                  {names.length ? names.map(firstName).join(', ') : '—'}
                </div>
              );
            })}
          </div>

          {/* Nattevakt */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>
              <Moon className="mr-1 h-3 w-3" /> Natt
            </LabelCell>
            {dates.map((date) => {
              const nights = (postsByDate.get(date) ?? []).filter((p) => p.is_night);
              const names = nights.flatMap((p) =>
                p.assignments.map((a) => firstName(staffToLeader.get(a.staff_id)?.name ?? '?')),
              );
              return (
                <div
                  key={date}
                  className={`rounded-xl border p-2 text-[11px] ${
                    names.length ? 'border-indigo-500/40 bg-indigo-500/10 font-semibold' : 'border-border/60 bg-muted/25 text-muted-foreground'
                  }`}
                >
                  {names.length ? names.join(', ') : '—'}
                </div>
              );
            })}
          </div>

          {/* Timer */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>Timer</LabelCell>
            {dates.map((date) => {
              const day = hoursByDate.get(date) ?? new Map<string, number>();
              const values = [...day.values()];
              const max = Number(week.max_daily_hours ?? 8);
              const over = values.filter((v) => v > max + 0.01).length;
              const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              return (
                <div
                  key={date}
                  className={`rounded-xl border p-2 text-[11px] ${
                    over ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border/60 bg-muted/25'
                  }`}
                >
                  <span className="font-bold tabular-nums">{avg.toFixed(1)}t</span>
                  <span className="text-muted-foreground"> snitt · {values.length} ledere</span>
                  {over > 0 && <p className="font-semibold">{over} over {max}t</p>}
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
      />
    </div>
  );
}
