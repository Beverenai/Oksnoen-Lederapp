import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
  onClick?: () => void;
}

export function StatTile({ label, value, hint, accent, onClick }: StatTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'rounded-2xl border border-border/60 bg-card/70 backdrop-blur px-3 py-3 text-left shadow-sm',
        onClick && 'active:scale-[0.98] transition-transform',
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold leading-none', accent)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground truncate">{hint}</p>}
    </button>
  );
}