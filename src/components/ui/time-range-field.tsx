import { useEffect, useMemo, useState } from 'react';
import { Clock, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
  const min = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h === 24) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Én rad: skriv klokkeslettet rett inn, eller juster med −/+ 15 min. */
function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const mins = toMin(value);
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
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${label} minus 15 minutter`}
        className="h-10 w-10 shrink-0 rounded-xl"
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
        className="h-10 min-w-0 flex-1 rounded-xl text-center text-base font-semibold tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${label} pluss 15 minutter`}
        className="h-10 w-10 shrink-0 rounded-xl"
        onClick={() => onChange(fromMin(mins + 15))}
      >
        <Plus className="h-4 w-4" />
      </Button>
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

  return (
    <div className={cn('space-y-2', className)}>
      <TimeRow label="Start" value={start} onChange={onStartChange} />
      <TimeRow label="Slutt" value={end} onChange={onEndChange} />

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
        className="z-50 w-[min(22rem,calc(100vw-2rem))] p-3"
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
