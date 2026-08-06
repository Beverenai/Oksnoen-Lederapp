import { cn } from '@/lib/utils';
import { getSnusProduct, snusLabel } from '@/lib/snusCatalog';

interface SnusBadgeProps {
  productId?: string | null;
  customLabel?: string | null;
  className?: string;
  showLabel?: boolean;
  /** Tiny icon-only version (no text) */
  compact?: boolean;
  /** Marks a shared snus ("Snus Brothers") */
  isBrother?: boolean;
}

/** Small can-shaped chip shown next to a leader who snuses */
export function SnusBadge({ productId, customLabel, className, showLabel = false, compact = false, isBrother = false }: SnusBadgeProps) {
  const product = getSnusProduct(productId);
  const label = snusLabel(productId, customLabel);
  const accent = product?.accent ?? 'hsl(var(--muted-foreground))';
  const title = isBrother
    ? `Snus Brother${label ? `: ${label}` : ''}`
    : label ? `Snuser: ${label}` : 'Snuser';

  if (compact) {
    return (
      <span
        className={cn(
          'relative inline-block h-2.5 w-2.5 shrink-0 rounded-full border align-middle',
          isBrother && 'ring-1 ring-primary/60',
          className
        )}
        style={{ borderColor: accent, background: `radial-gradient(circle at 35% 30%, #fff, ${accent})` }}
        title={title}
        aria-label={title}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold leading-none',
        className
      )}
      title={title}
    >
      <span
        className="relative inline-block h-3 w-3 rounded-full border"
        style={{ borderColor: accent, background: `radial-gradient(circle at 35% 30%, #fff, ${accent})` }}
      >
        <span
          className="absolute inset-[3px] rounded-full border"
          style={{ borderColor: 'rgba(255,255,255,0.7)' }}
        />
      </span>
      {showLabel && label ? <span className="max-w-[120px] truncate">{label}</span> : <span>Snus</span>}
    </span>
  );
}
