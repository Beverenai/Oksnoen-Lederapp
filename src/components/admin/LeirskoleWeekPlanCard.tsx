import { useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Grid3X3, Plus, X } from 'lucide-react';
import {
  useLeirskoleActivityTypes,
  useLeirskoleWeekPlan,
  useSaveLeirskoleWeekPlanCell,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const ROWS = [
  { index: 1, label: '1. økt' },
  { index: 2, label: '2. økt' },
  { index: 3, label: '3. økt' },
];

const COLORS: { key: string; label: string; cell: string; dot: string }[] = [
  { key: 'neutral', label: 'Nøytral', cell: 'bg-muted/40 border-border', dot: 'bg-muted-foreground/40' },
  { key: 'red', label: 'Rød', cell: 'bg-destructive/15 border-destructive/50', dot: 'bg-destructive' },
  { key: 'orange', label: 'Oransje', cell: 'bg-amber-500/15 border-amber-500/50', dot: 'bg-amber-500' },
  { key: 'green', label: 'Grønn', cell: 'bg-emerald-500/15 border-emerald-500/50', dot: 'bg-emerald-500' },
];

function parse(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}
function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const a = parse(start);
  const b = parse(end);
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}
const cellKey = (date: string, row: number) => `${date}|${row}`;
const splitLines = (content: string) =>
  content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Ukeplanleggeren: rutenett med dagene som kolonner og økt 1–3 som rader.
 * Innholdet velges fra aktivitetslista (ingen manuell skriving) + farge per rute.
 */
export function LeirskoleWeekPlanCard({ week, readOnly = false }: { week: LeirskoleWeek; readOnly?: boolean }) {
  const { data: cells } = useLeirskoleWeekPlan(week.id);
  const { data: activityTypes } = useLeirskoleActivityTypes(true);
  const save = useSaveLeirskoleWeekPlanCell();
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  const stored = useMemo(() => {
    const map = new Map<string, { content: string; color: string }>();
    (cells ?? []).forEach((c) => map.set(cellKey(c.date, c.row_index), { content: c.content, color: c.color }));
    return map;
  }, [cells]);

  const persist = (date: string, row: number, content: string, color: string) => {
    save.mutate(
      { weekId: week.id, date, rowIndex: row, content, color },
      { onError: () => toast.error('Kunne ikke lagre ruten') },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Grid3X3 className="h-4 w-4 text-primary" /> Ukeplanlegger
        </CardTitle>
        <CardDescription>
          Velg aktiviteter fra lista i hver rute (økt 1–3). Trykk på fargeprikkene for å markere ruten. Lagres
          automatisk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 overflow-x-auto px-2 pb-2">
          <div className="flex min-w-max gap-2">
            {dates.map((date) => {
              const d = parse(date);
              return (
                <div key={date} className="w-44 shrink-0">
                  <div className="oks-ls-gradient mb-2 rounded-xl px-2 py-1.5 text-center">
                    <p className="text-xs font-bold text-white">
                      {WEEKDAYS[d.getDay()]} {d.getDate()}.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {ROWS.map((row) => {
                      const key = cellKey(date, row.index);
                      const current = stored.get(key);
                      const color = current?.color ?? 'neutral';
                      const style = COLORS.find((c) => c.key === color) ?? COLORS[0];
                      const value = current?.content ?? '';
                      const lines = splitLines(value);
                      const setLines = (next: string[]) => persist(date, row.index, next.join('\n'), color);
                      return (
                        <div key={row.index} className={`rounded-xl border p-1.5 ${style.cell}`}>
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {row.label}
                            </span>
                            {!readOnly && (
                              <div className="flex items-center gap-1">
                                {COLORS.map((c) => (
                                  <button
                                    key={c.key}
                                    type="button"
                                    aria-label={c.label}
                                    onClick={() => persist(date, row.index, value, c.key)}
                                    className={`h-3 w-3 rounded-full ${c.dot} ${
                                      color === c.key ? 'ring-2 ring-foreground/50' : 'opacity-60'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="min-h-[3rem] space-y-1">
                            {lines.length === 0 && (
                              <p className="px-1 text-xs text-muted-foreground">—</p>
                            )}
                            {lines.map((line, i) => (
                              <div
                                key={`${line}-${i}`}
                                className="flex items-center gap-1 rounded-lg bg-background/70 px-1.5 py-1 text-xs font-medium"
                              >
                                <span className="flex-1 truncate">{line}</span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    aria-label={`Fjern ${line}`}
                                    onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {!readOnly && (
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
                                    {(activityTypes ?? []).length === 0 && (
                                      <p className="p-2 text-xs text-muted-foreground">
                                        Ingen aktiviteter — legg dem inn i «Aktiviteter».
                                      </p>
                                    )}
                                    {(activityTypes ?? []).map((a) => {
                                      const text = `${a.emoji ?? ''} ${a.label}`.trim();
                                      const active = lines.includes(text);
                                      return (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() =>
                                            setLines(active ? lines.filter((l) => l !== text) : [...lines, text])
                                          }
                                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                            active ? 'bg-primary/15 font-semibold' : 'hover:bg-muted'
                                          }`}
                                        >
                                          <span>{a.emoji ?? '•'}</span>
                                          <span className="flex-1 truncate">{a.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
