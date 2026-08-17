import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Grid3X3 } from 'lucide-react';
import { useLeirskoleWeekPlan, useSaveLeirskoleWeekPlanCell, type LeirskoleWeek } from '@/hooks/useLeirskole';

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const ROWS = [
  { index: 1, label: '1. økt' },
  { index: 2, label: '2. økt' },
  { index: 3, label: '3. økt' },
  { index: 4, label: 'Legging' },
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

/**
 * Ukeplanleggeren: rutenett med dagene som kolonner og øktene + legging som
 * rader — som regnearket vi bruker på sommerleir. Fritekst + farge per rute.
 */
export function LeirskoleWeekPlanCard({ week, readOnly = false }: { week: LeirskoleWeek; readOnly?: boolean }) {
  const { data: cells } = useLeirskoleWeekPlan(week.id);
  const save = useSaveLeirskoleWeekPlanCell();
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const stored = useMemo(() => {
    const map = new Map<string, { content: string; color: string }>();
    (cells ?? []).forEach((c) => map.set(cellKey(c.date, c.row_index), { content: c.content, color: c.color }));
    return map;
  }, [cells]);

  useEffect(() => {
    setDrafts({});
  }, [week.id]);

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
          Fyll ut rutene som i regnearket. Trykk på fargeprikkene for å markere ruten. Lagres automatisk.
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
                      const value = drafts[key] ?? current?.content ?? '';
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
                          {readOnly ? (
                            <p className="min-h-[3rem] whitespace-pre-wrap text-xs">{value || '—'}</p>
                          ) : (
                            <Textarea
                              value={value}
                              rows={3}
                              placeholder="—"
                              className="min-h-[3.5rem] resize-none border-0 bg-transparent p-1 text-xs focus-visible:ring-0"
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                              onBlur={() => {
                                if ((current?.content ?? '') === value) return;
                                persist(date, row.index, value, color);
                              }}
                            />
                          )}
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
