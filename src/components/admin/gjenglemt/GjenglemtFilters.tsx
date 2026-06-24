import { COLORS, GARMENT_TYPES } from '@/lib/gjenglemtConstants';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Props {
  color: string | null;
  garment: string | null;
  onColor: (v: string | null) => void;
  onGarment: (v: string | null) => void;
  className?: string;
}

export function GjenglemtFilters({ color, garment, onColor, onGarment, className }: Props) {
  const hasFilter = color || garment;
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Farge</span>
          {color && (
            <button onClick={() => onColor(null)} className="text-xs text-muted-foreground hover:text-foreground">Nullstill</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => {
            const active = color === c.value;
            return (
              <button
                key={c.value}
                onClick={() => onColor(active ? null : c.value)}
                title={c.label}
                aria-label={c.label}
                className={cn(
                  'h-9 w-9 rounded-full border-2 transition-all',
                  active ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:scale-105',
                )}
                style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plagg</span>
          {garment && (
            <button onClick={() => onGarment(null)} className="text-xs text-muted-foreground hover:text-foreground">Nullstill</button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GARMENT_TYPES.map(g => {
            const active = garment === g.value;
            return (
              <button
                key={g.value}
                onClick={() => onGarment(active ? null : g.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted',
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasFilter && (
        <button
          onClick={() => { onColor(null); onGarment(null); }}
          className="self-start text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Nullstill alle
        </button>
      )}
    </div>
  );
}