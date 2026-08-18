import { memo, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Minus, NotebookPen } from 'lucide-react';
import {
  useLeirskoleActivityTypes,
  useLeirskoleWeekDays,
  useLeirskoleWeekPlan,
  useSaveLeirskoleWeekPlanCell,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import { useSeedLeirskoleSpecialDays } from '@/hooks/useSeedLeirskoleSpecialDays';
import { assignMissingActivities } from '@/lib/leirskoleAutoActivity';
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
  const qc = useQueryClient();
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
      {
        onError: () => toast.error('Kunne ikke lagre ruten'),
        // Aktiviteten skal straks få en leder som er på vakt i den økten.
        // Er ingen ledig, står den tom til vaktplanen genereres.
        onSuccess: async () => {
          try {
            const n = await assignMissingActivities({ weekId: week.id, date });
            ['leirskole-activities', 'leirskole-week-plan', 'leirskole-schedule'].forEach((key) =>
              qc.invalidateQueries({ queryKey: [key] }),
            );
            if (n > 0) toast.success(`${n} aktivitet${n === 1 ? '' : 'er'} fikk leder`);
          } catch {
            /* Ingen leder på vakt ennå — aktiviteten står tom. */
          }
        },
      },
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
        <div className="overflow-x-auto px-3 pb-4">
          <div
            className="min-w-max"
            style={{ ['--oks-cols' as string]: `repeat(${dates.length}, minmax(9.5rem, 1fr))` }}
          >
            {/* Dagene bortover */}
            <div className="grid gap-1" style={{ gridTemplateColumns: 'var(--oks-row-label, 3.25rem) var(--oks-cols)' }}>
              <span />
              {dates.map((date) => (
                <div key={date} className="flex items-baseline gap-1 px-1 pb-1">
                  <span className="text-xs font-bold">{dayLabel(date)}</span>
                  {specialDays.get(date) && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-200">
                      {specialDays.get(date) === 'both' ? 'av+an' : specialDays.get(date) === 'arrival' ? 'ank' : 'avr'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Øktene nedover */}
            {ROWS.map((r, rowIdx) => (
              <div
                key={r.row}
                className="grid gap-1 py-0.5"
                style={{ gridTemplateColumns: 'var(--oks-row-label, 3.25rem) var(--oks-cols)' }}
              >
                <div className="flex flex-col justify-center px-1">
                  <span className="text-xs font-bold tabular-nums">{r.row}</span>
                  <span className="text-[9px] leading-tight text-muted-foreground">{r.time}</span>
                </div>
                {dates.map((date) => {
                  const cell = stored.get(`${date}|${r.row}`);
                  return (
                    <PlanCell
                      key={date}
                      lines={splitLines(cell?.content ?? '')}
                      tint={ROW_TINT[rowIdx]}
                      types={types ?? []}
                      onChange={(next) => persist(date, r.row, next, cell?.color ?? 'neutral')}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Trykk i en rute for å legge inn aktiviteter. «Klatring ×2» betyr at to ledere skal ha klatring i den økten.
          </p>
        </div>
      )}
    </div>
  );
}

type PlanCellProps = {
  lines: string[];
  tint: string;
  types: { id: string; label: string; emoji: string | null }[];
  onChange: (next: string[]) => void;
};

/** Én rute i regnearket — kompakt visning, redigering i popover. */
const PlanCell = memo(function PlanCell({ lines, tint, types, onChange }: PlanCellProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`min-h-[3.25rem] min-w-0 rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:ring-1 hover:ring-primary/40 ${tint}`}
        >
          {lines.length === 0 ? (
            <span className="text-muted-foreground">+</span>
          ) : (
            <span className="block space-y-0.5">
              {lines.map((line) => (
                <span key={line} className="block truncate font-medium">
                  {stripMultiplier(line)}
                  {lineMultiplier(line) > 1 && (
                    <span className="tabular-nums text-muted-foreground"> ×{lineMultiplier(line)}</span>
                  )}
                </span>
              ))}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1">
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {types.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Ingen aktiviteter — legg dem inn i «Aktivitetstyper».</p>
          )}
          {types.map((a) => {
            const text = `${a.emoji ?? ''} ${a.label}`.trim();
            const count = countActivity(lines, a.label);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${count > 0 ? 'bg-primary/15 font-semibold' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onChange(setActivityCount(lines, a.label, text, count + 1))}
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
                    onClick={() => onChange(setActivityCount(lines, a.label, text, count - 1))}
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
  );
});
