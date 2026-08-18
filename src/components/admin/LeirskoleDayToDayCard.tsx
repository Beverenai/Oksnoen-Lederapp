import { memo, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Minus, NotebookPen, Plus } from 'lucide-react';
import {
  useLeirskoleActivityTypes,
  useLeirskoleWeekDays,
  useLeirskoleWeekPlan,
  useSaveLeirskoleWeekPlanCell,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import { useSeedLeirskoleSpecialDays } from '@/hooks/useSeedLeirskoleSpecialDays';
import { countActivity, setActivityCount, lineMultiplier, stripMultiplier } from '@/lib/leirskoleCellInstances';
import { dayLabel } from '@/lib/leirskoleDates';

const ROWS = [
  { row: 1, label: 'Økt 1', time: '11–14' },
  { row: 2, label: 'Økt 2', time: '16–19' },
  { row: 3, label: 'Økt 3', time: '20–21.30' },
];

/** Fargekode på annenhver økt-rad, som i regnearket. */
const ROW_TINT = [
  'bg-destructive/10 dark:bg-destructive/20',
  'bg-amber-500/15 dark:bg-amber-500/20',
  'bg-destructive/10 dark:bg-destructive/20',
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

const splitLines = (content: string) =>
  content.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * «Dag til dag»: dagene nedover, Økt 1–3 bortover.
 * Aktivitetene velges fra lista og får antall ledere (f.eks. «Klatring x2»).
 */
export function LeirskoleDayToDayCard({ week }: { week: LeirskoleWeek }) {
  const { data: cells } = useLeirskoleWeekPlan(week.id);
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const save = useSaveLeirskoleWeekPlanCell();
  useSeedLeirskoleSpecialDays(week);
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  const stored = useMemo(() => {
    const map = new Map<string, { content: string; color: string }>();
    (cells ?? []).forEach((c) => {
      if (c.row_index != null) map.set(`${c.date}|${c.row_index}`, { content: c.content ?? '', color: c.color ?? 'neutral' });
    });
    return map;
  }, [cells]);

  const specialDays = useMemo(() => {
    const map = new Map<string, string>();
    (weekDays ?? []).forEach((d) => {
      if (d.day_type && d.day_type !== 'normal') map.set(d.date, d.day_type);
    });
    return map;
  }, [weekDays]);

  const filled = useMemo(
    () =>
      dates.reduce(
        (sum, date) => sum + ROWS.filter((r) => (stored.get(`${date}|${r.row}`)?.content ?? '').trim().length > 0).length,
        0,
      ),
    [dates, stored],
  );

  // Åpen/lukket huskes, slik at den ikke lukker seg når dataene oppdateres.
  const [open, setOpen] = useState(() => localStorage.getItem('leirskole-daytoday-open') !== '0');
  const toggle = () => {
    setOpen((v) => {
      localStorage.setItem('leirskole-daytoday-open', v ? '0' : '1');
      return !v;
    });
  };

  const persist = (date: string, row: number, lines: string[], color: string) => {
    save.mutate(
      { weekId: week.id, date, rowIndex: row, content: lines.join('\n'), color },
      { onError: () => toast.error('Kunne ikke lagre ruten') },
    );
  };

  return (
    <div className="oks-ls-pill oks-ls-stripe overflow-hidden">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 p-4 text-left">
        <NotebookPen className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Dag til dag</span>
          <span className="block truncate text-xs text-muted-foreground">
            Hvilke aktiviteter skal gjøres i hver økt — og hvor mange ledere
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {filled} av {dates.length * ROWS.length}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-4">
          <div className="hidden gap-2 px-1 sm:grid sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))]">
            <span />
            {ROWS.map((r) => (
              <span key={r.row} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {r.label} <span className="font-normal normal-case">{r.time}</span>
              </span>
            ))}
          </div>

          {dates.map((date) => {
            const special = specialDays.get(date);
            return (
              <div
                key={date}
                className="grid gap-2 rounded-2xl border border-border/60 bg-card p-2 sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))]"
              >
                <div className="flex items-center gap-2 px-1 sm:flex-col sm:items-start sm:justify-center sm:gap-1">
                  <p className="text-sm font-bold">{dayLabel(date)}</p>
                  {special && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-200">
                      {special === 'both' ? 'Avreise + ankomst' : special === 'arrival' ? 'Ankomst' : 'Avreise'}
                    </span>
                  )}
                </div>

                {ROWS.map((r, colIdx) => {
                  const key = `${date}|${r.row}`;
                  const cell = stored.get(key);
                  const lines = splitLines(cell?.content ?? '');
                  const color = cell?.color ?? 'neutral';
                  const setLines = (next: string[]) => persist(date, r.row, next, color);
                  return (
                    <div key={r.row} className={`min-w-0 rounded-xl p-1.5 ${COLUMN_TINT[colIdx]}`}>
                      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">
                        {r.label} <span className="font-normal normal-case">{r.time}</span>
                      </p>
                      <div className="space-y-1">
                        {lines.length === 0 && <p className="px-1 text-xs text-muted-foreground">—</p>}
                        {lines.map((line) => {
                          const n = lineMultiplier(line);
                          const label = stripMultiplier(line);
                          const type = (types ?? []).find((t) => label.toLowerCase().includes(t.label.toLowerCase()));
                          const change = (delta: number) => {
                            if (!type) {
                              if (delta < 0) setLines(lines.filter((l) => l !== line));
                              return;
                            }
                            setLines(setActivityCount(lines, type.label, label, n + delta));
                          };
                          return (
                            <div
                              key={line}
                              className="flex items-center gap-1 rounded-lg bg-background/80 px-1.5 py-1 text-xs font-medium"
                            >
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">×{n}</span>
                              <button
                                type="button"
                                aria-label={`Færre på ${label}`}
                                onClick={() => change(-1)}
                                className="rounded-full bg-muted/70 p-0.5 hover:bg-muted"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Flere på ${label}`}
                                onClick={() => change(1)}
                                className="rounded-full bg-muted/70 p-0.5 hover:bg-muted"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}

                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1 text-[11px] font-semibold text-muted-foreground hover:bg-background/60"
                            >
                              <Plus className="h-3 w-3" /> Aktivitet
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-56 p-1">
                            <div className="max-h-64 space-y-0.5 overflow-y-auto">
                              {(types ?? []).length === 0 && (
                                <p className="p-2 text-xs text-muted-foreground">
                                  Ingen aktiviteter — legg dem inn i «Aktivitetstyper».
                                </p>
                              )}
                              {(types ?? []).map((a) => {
                                const text = `${a.emoji ?? ''} ${a.label}`.trim();
                                const count = countActivity(lines, a.label);
                                return (
                                  <div
                                    key={a.id}
                                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                                      count > 0 ? 'bg-primary/15 font-semibold' : ''
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setLines(setActivityCount(lines, a.label, text, count + 1))}
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                      <span>{a.emoji ?? '•'}</span>
                                      <span className="flex-1 truncate">{a.label}</span>
                                      {count > 0 && <span className="tabular-nums text-xs">×{count}</span>}
                                    </button>
                                    {count > 0 && (
                                      <button
                                        type="button"
                                        aria-label={`Færre på ${a.label}`}
                                        onClick={() => setLines(setActivityCount(lines, a.label, text, count - 1))}
                                        className="rounded-full bg-muted/70 p-0.5"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <p className="px-1 text-[11px] text-muted-foreground">
            «Klatring x2» betyr at to ledere skal ha klatring i den økten — generatoren bemanner etter dette.
          </p>
        </div>
      )}
    </div>
  );
}
