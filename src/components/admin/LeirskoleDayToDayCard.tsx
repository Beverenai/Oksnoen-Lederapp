import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ChevronDown, Minus, NotebookPen, Plus, Sparkles } from 'lucide-react';
import {
  useAddLeirskoleActivityType,
  useLeirskoleActivityTypes,
  useLeirskoleSchedule,
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

/** Vaktnavn som ikke er egne økter — resten (Ankomst/Avreise) fyller ledige øktrader. */
const RESERVED_POSTS = new Set([
  'økt 1',
  'økt 2',
  'økt 3',
  'frokost',
  'lunsj',
  'middag',
  'kvelds',
  'sanitas',
  'nattevakt',
]);

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
  const { data: posts } = useLeirskoleSchedule(week.id);
  const save = useSaveLeirskoleWeekPlanCell();
  const qc = useQueryClient();
  useSeedLeirskoleSpecialDays(week);
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);
  /** Ruter som nettopp er endret — vises med en gang, byttes ut når serveren svarer. */
  const [pending, setPending] = useState<Record<string, string[]>>({});
  /** Aktivitetsfordelingen samles opp, så raske klikk ikke gir en storm av kall. */
  const assignTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(
    () => () => {
      Object.values(assignTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const stored = useMemo(() => {
    const map = new Map<string, { content: string; color: string }>();
    (cells ?? []).forEach((c) => {
      const key = c.post_id ? `post|${c.post_id}` : c.row_index != null ? `${c.date}|${c.row_index}` : null;
      if (key) map.set(key, { content: c.content ?? '', color: c.color ?? 'neutral' });
    });
    return map;
  }, [cells]);

  /**
   * Rutene i «Dag til dag». På ankomst- og avreisedager finnes ikke «Økt 1»;
   * da hører raden til dagens egen vakt (Ankomst/Avreise), slik at aktivitetene
   * havner på samme økt som dagsvisningen og vaktplanen bruker.
   */
  const slots = useMemo(() => {
    const map = new Map<string, { key: string; rowIndex: number | null; postId: string | null; label: string }>();
    dates.forEach((date) => {
      const dayPosts = (posts ?? []).filter((p) => p.date === date);
      const extras = dayPosts
        .filter((p) => !RESERVED_POSTS.has((p.name ?? '').trim().toLowerCase()))
        .slice()
        .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
      let extraIdx = 0;
      ROWS.forEach((r) => {
        const post = dayPosts.find((p) => (p.name ?? '').trim().toLowerCase() === r.label.toLowerCase());
        const extra = !post ? extras[extraIdx] : undefined;
        if (extra) extraIdx += 1;
        map.set(
          `${date}|${r.row}`,
          extra
            ? { key: `post|${extra.id}`, rowIndex: null, postId: extra.id, label: extra.name?.trim() || r.label }
            : { key: `${date}|${r.row}`, rowIndex: r.row, postId: null, label: post?.name?.trim() || r.label },
        );
      });
    });
    return map;
  }, [dates, posts]);

  // Når serveren har svart med samme innhold, slipper vi den optimistiske ruten.
  useEffect(() => {
    setPending((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const next: Record<string, string[]> = {};
      let changed = false;
      keys.forEach((key) => {
        const server = splitLines(stored.get(key)?.content ?? '').join('\n');
        if (server === prev[key].join('\n')) changed = true;
        else next[key] = prev[key];
      });
      return changed ? next : prev;
    });
  }, [stored]);

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
        (sum, date) =>
          sum +
          ROWS.filter((r) => {
            const slot = slots.get(`${date}|${r.row}`);
            return (stored.get(slot?.key ?? `${date}|${r.row}`)?.content ?? '').trim().length > 0;
          }).length,
        0,
      ),
    [dates, slots, stored],
  );


  // Åpen/lukket huskes, slik at den ikke lukker seg når dataene oppdateres.
  const [open, setOpen] = useState(() => localStorage.getItem('leirskole-daytoday-open') !== '0');
  const toggle = () => {
    setOpen((v) => {
      localStorage.setItem('leirskole-daytoday-open', v ? '0' : '1');
      return !v;
    });
  };

  const persist = useCallback(
    (
      date: string,
      slot: { key: string; rowIndex: number | null; postId: string | null },
      lines: string[],
      color: string,
    ) => {
      const key = slot.key;
      setPending((prev) => ({ ...prev, [key]: lines }));
      save.mutate(
        { weekId: week.id, date, rowIndex: slot.rowIndex, postId: slot.postId, content: lines.join('\n'), color },
        {
          onError: () => {
            setPending((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            toast.error('Kunne ikke lagre ruten');
          },
          // Aktiviteten skal få en leder som er på vakt i den økten. Er ingen
          // ledig, står den tom til vaktplanen genereres. Vi venter litt, slik
          // at flere raske klikk i samme dag blir én fordeling.
          onSuccess: () => {
            clearTimeout(assignTimers.current[date]);
            assignTimers.current[date] = setTimeout(async () => {
              try {
                const n = await assignMissingActivities({ weekId: week.id, date });
                if (n > 0) {
                  ['leirskole-activities', 'leirskole-schedule'].forEach((k) =>
                    qc.invalidateQueries({ queryKey: [k] }),
                  );
                  toast.success(`${n} aktivitet${n === 1 ? '' : 'er'} fikk leder`);
                }
              } catch {
                /* Ingen leder på vakt ennå — aktiviteten står tom. */
              }
            }, 900);
          },
        },
      );
    },
    [qc, save, week.id],
  );

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
            className="oks-dtd-grid min-w-max lg:min-w-full"
            style={{ ['--oks-cols' as string]: `repeat(${dates.length}, minmax(var(--oks-daymin, 9.5rem), 1fr))` }}
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
                  const slot =
                    slots.get(`${date}|${r.row}`) ??
                    { key: `${date}|${r.row}`, rowIndex: r.row, postId: null, label: r.label };
                  const cell = stored.get(slot.key);
                  return (
                    <PlanCell
                      key={date}
                      label={slot.label !== r.label ? slot.label : undefined}
                      lines={pending[slot.key] ?? splitLines(cell?.content ?? '')}
                      tint={ROW_TINT[rowIdx]}
                      types={types ?? []}
                      onChange={(next) => persist(date, slot, next, cell?.color ?? 'neutral')}
                    />
                  );
                })}

              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Trykk i en rute for å legge inn aktiviteter. «Klatring ×2» betyr at to ledere skal ha klatring i den økten.
            Du kan lage en egen aktivitet nederst i ruten — den kan alle ledere ta.
          </p>
        </div>
      )}
    </div>
  );
}

type PlanCellProps = {
  lines: string[];
  tint: string;
  types: { id: string; label: string; emoji: string | null; is_custom?: boolean }[];
  onChange: (next: string[]) => void;
};

/** Én rute i regnearket — kompakt visning, redigering i popover. */
const PlanCell = memo(function PlanCell({ lines, tint, types, onChange }: PlanCellProps) {
  const addType = useAddLeirskoleActivityType();
  const [customOpen, setCustomOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  /** Lager en egen aktivitet og legger den rett inn i ruten. */
  const createCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    addType.mutate(
      { label, emoji: '✨', sortOrder: 900, isCustom: true },
      {
        onSuccess: (created) => {
          const text = `${created.emoji ?? '✨'} ${created.label}`.trim();
          onChange(setActivityCount(lines, created.label, text, countActivity(lines, created.label) + 1));
          setCustomLabel('');
          setCustomOpen(false);
          toast.success(`${created.label} lagt til`);
        },
        onError: () => toast.error('Kunne ikke lage aktiviteten'),
      },
    );
  };

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
      <PopoverContent align="start" collisionPadding={12} className="w-64 p-1">
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

        <div className="mt-1 border-t border-border/60 pt-1">
          {customOpen ? (
            <div className="flex items-center gap-1 p-1">
              <Input
                autoFocus
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createCustom();
                  if (e.key === 'Escape') setCustomOpen(false);
                }}
                placeholder="Egen aktivitet …"
                className="h-8 rounded-xl text-xs"
              />
              <button
                type="button"
                aria-label="Lag aktiviteten"
                onClick={createCustom}
                disabled={addType.isPending || !customLabel.trim()}
                className="shrink-0 rounded-full bg-primary p-1.5 text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ny egen aktivitet
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});
