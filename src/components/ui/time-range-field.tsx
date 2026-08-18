import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Clock, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 06 - 24
const MINUTES = [0, 15, 30, 45];

function toMin(v: string) {
  const [h, m] = (v || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
function fromMin(total: number) {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function fmtDur(mins: number) {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? `${h}t` : ''}${m > 0 ? ` ${m}m` : ''}`.trim();
}

/** Godtar «9», «930», «9:3», «21.00» osv. og gjør det om til HH:MM. */
function parseTyped(raw: string): string | null {
  const s = raw.trim().replace(/[.,\s]/g, ':');
  const m = s.match(/^(\d{1,2})(?::?(\d{0,2}))?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h === 24) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function TimePicker({
  label,
  value,
  onChange,
  open,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const mins = toMin(value);
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = (raw: string) => {
    const parsed = parseTyped(raw);
    if (parsed) {
      setText(parsed);
      if (parsed !== value) onChange(parsed);
    } else {
      setText(value);
    }
  };

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-stretch gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${label} minus 15 minutter`}
          className="h-11 w-9 shrink-0 rounded-xl"
          onClick={() => onChange(fromMin(mins - 15))}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
              e.currentTarget.blur();
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(fromMin(mins + 15));
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(fromMin(mins - 15));
            }
          }}
          inputMode="numeric"
          placeholder="--:--"
          aria-label={`${label} klokkeslett`}
          className="h-11 min-w-0 flex-1 rounded-xl text-center text-lg font-semibold tabular-nums"
        />

        <Button
          type="button"
          variant={open ? 'default' : 'outline'}
          size="icon"
          aria-label={`Velg ${label} fra liste`}
          aria-expanded={open}
          className="h-11 w-9 shrink-0 rounded-xl"
          onClick={onToggle}
        >
          <Clock className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${label} pluss 15 minutter`}
          className="h-11 w-9 shrink-0 rounded-xl"
          onClick={() => onChange(fromMin(mins + 15))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-border/70 bg-muted/30 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Time</p>
          <div className="grid grid-cols-5 gap-1">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onChange(fromMin(h * 60 + minute))}
                className={cn(
                  'h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors',
                  h === hour ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {String(h % 24).padStart(2, '0')}
              </button>
            ))}
          </div>
          <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Minutt</p>
          <div className="grid grid-cols-4 gap-1">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange(fromMin(hour * 60 + m))}
                className={cn(
                  'h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors',
                  m === minute ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                :{String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface TimeRangeFieldProps {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  presets?: { label: string; start: string; end: string }[];
  className?: string;
}

const DEFAULT_PRESETS = [
  { label: 'Frokost', start: '08:00', end: '09:00' },
  { label: 'Økt 1', start: '09:00', end: '11:30' },
  { label: 'Økt 2', start: '12:30', end: '15:00' },
  { label: 'Økt 3', start: '16:00', end: '18:00' },
  { label: 'Kveld', start: '19:00', end: '22:00' },
];

export function TimeRangeField({
  start,
  end,
  onStartChange,
  onEndChange,
  presets = DEFAULT_PRESETS,
  className,
}: TimeRangeFieldProps) {
  const duration = useMemo(() => {
    const d = toMin(end) - toMin(start);
    return d < 0 ? d + 1440 : d;
  }, [start, end]);

  const invalid = !start || !end || duration === 0;
  const [openField, setOpenField] = useState<'start' | 'end' | null>(null);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-2">
        <TimePicker
          label="Start"
          value={start}
          onChange={onStartChange}
          open={openField === 'start'}
          onToggle={() => setOpenField((v) => (v === 'start' ? null : 'start'))}
        />
        <TimePicker
          label="Slutt"
          value={end}
          onChange={onEndChange}
          open={openField === 'end'}
          onToggle={() => setOpenField((v) => (v === 'end' ? null : 'end'))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold',
            invalid ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
          )}
        >
          {invalid ? 'Sett gyldig tid' : `Varighet ${fmtDur(duration)}`}
        </span>
        {presets.map((p) => {
          const active = p.start === start && p.end === end;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                onStartChange(p.start);
                onEndChange(p.end);
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-background hover:bg-muted',
              )}
            >
              {p.label} <span className="opacity-60 tabular-nums">{p.start}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TimeRangePopoverProps {
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
  presets?: { label: string; start: string; end: string }[];
  className?: string;
}

/** Compact trigger ("09:00–11:30") that opens the full picker in a popover. */
export function TimeRangePopover({ start, end, onChange, presets, className }: TimeRangePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-8 shrink-0 gap-1 rounded-xl px-2 text-xs font-semibold tabular-nums', className)}
        >
          <Clock className="h-3.5 w-3.5 opacity-60" />
          {start}–{end}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="z-50 max-h-[min(70vh,32rem)] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto p-3"
      >
        <TimeRangeField
          start={start}
          end={end}
          onStartChange={(v) => onChange({ start: v, end })}
          onEndChange={(v) => onChange({ start, end: v })}
          presets={presets}
        />
      </PopoverContent>
    </Popover>
  );
}
