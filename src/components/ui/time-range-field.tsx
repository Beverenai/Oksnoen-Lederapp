import { useMemo } from 'react';
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

function TimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const mins = toMin(value);
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;

  return (
    <div className="flex-1">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-stretch gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${label} minus 15 minutter`}
          className="h-12 w-10 shrink-0 rounded-xl"
          onClick={() => onChange(fromMin(mins - 15))}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl px-2 text-xl font-semibold tabular-nums"
            >
              <Clock className="mr-1.5 h-4 w-4 opacity-60" />
              {value || '--:--'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-[264px] p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Time</p>
            <div className="grid grid-cols-5 gap-1">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onChange(fromMin(h * 60 + minute))}
                  className={cn(
                    'h-9 rounded-lg text-sm font-medium tabular-nums transition-colors',
                    h === hour ? 'bg-primary text-primary-foreground' : 'bg-muted/60 hover:bg-muted',
                  )}
                >
                  {String(h % 24).padStart(2, '0')}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Minutt
            </p>
            <div className="grid grid-cols-4 gap-1">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange(fromMin(hour * 60 + m))}
                  className={cn(
                    'h-9 rounded-lg text-sm font-medium tabular-nums transition-colors',
                    m === minute ? 'bg-primary text-primary-foreground' : 'bg-muted/60 hover:bg-muted',
                  )}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${label} pluss 15 minutter`}
          className="h-12 w-10 shrink-0 rounded-xl"
          onClick={() => onChange(fromMin(mins + 15))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
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
      <div className="flex items-end gap-2">
        <TimePicker label="Start" value={start} onChange={onStartChange} />
        <TimePicker label="Slutt" value={end} onChange={onEndChange} />
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
