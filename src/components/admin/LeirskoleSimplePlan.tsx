import { useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useLeirskoleWeekPlan, useSaveLeirskoleWeekPlanCell } from '@/hooks/useLeirskole';
import { dayLabel } from '@/lib/leirskoleDates';

const ROWS = [
  { row: 1, label: 'Økt 1', time: '11–14' },
  { row: 2, label: 'Økt 2', time: '16–19' },
  { row: 3, label: 'Økt 3', time: '20–21.30' },
];

/**
 * Enkel dag-til-dag-plan: kun hvilke aktiviteter vi skal gjøre i hver økt.
 * Fritekst per rute, lagres når du forlater feltet.
 */
export function LeirskoleSimplePlan({
  weekId,
  dates,
  dayTypes,
}: {
  weekId: string;
  dates: string[];
  /** date -> 'arrival' | 'departure' | 'both' for merking av dagen. */
  dayTypes: Map<string, string>;
}) {
  const { data: cells } = useLeirskoleWeekPlan(weekId);
  const save = useSaveLeirskoleWeekPlanCell();

  const content = useMemo(() => {
    const map = new Map<string, string>();
    (cells ?? []).forEach((c) => {
      if (c.row_index != null) map.set(`${c.date}|${c.row_index}`, c.content ?? '');
    });
    return map;
  }, [cells]);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    (cells ?? []).forEach((c) => {
      if (c.row_index != null) map.set(`${c.date}|${c.row_index}`, c.color ?? 'neutral');
    });
    return map;
  }, [cells]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Skriv inn aktivitetene for hver økt — én per linje. Dette er planen lederne ser i uken.
      </p>
      {dates.map((date) => {
        const special = dayTypes.get(date);
        return (
          <div key={date} className="rounded-2xl border border-border/60 bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-bold">{dayLabel(date)}</p>
              {special && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-200">
                  {special === 'both' ? 'Avreise + ankomst' : special === 'arrival' ? 'Ankomst' : 'Avreise'}
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROWS.map((r) => {
                const key = `${date}|${r.row}`;
                return (
                  <label key={r.row} className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.label} <span className="font-normal normal-case">{r.time}</span>
                    </span>
                    <Textarea
                      key={`${key}-${content.get(key) ?? ''}`}
                      defaultValue={content.get(key) ?? ''}
                      rows={4}
                      placeholder="Klatring&#10;Tube&#10;Badevakt"
                      className="resize-y rounded-xl text-sm"
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === (content.get(key) ?? '')) return;
                        save.mutate({
                          weekId,
                          date,
                          rowIndex: r.row,
                          content: value,
                          color: colorOf.get(key) ?? 'neutral',
                        });
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}