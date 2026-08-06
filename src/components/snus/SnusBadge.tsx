import { cn } from '@/lib/utils';
import { getSnusProduct, snusLabel, snusTheme, customSnusProduct } from '@/lib/snusCatalog';

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

/** Tiny 3/4-view snus can icon */
export function SnusCanIcon({ productId, customLabel, size = 14, className }: {
  productId?: string | null;
  customLabel?: string | null;
  size?: number;
  className?: string;
}) {
  const product = getSnusProduct(productId) ?? customSnusProduct(customLabel || 'Snus');
  const theme = snusTheme(product);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* side wall */}
      <path
        d="M2.5 9.5c0-1 4.2-2.2 9.5-2.2s9.5 1.2 9.5 2.2v5.6c0 1.4-4.2 2.6-9.5 2.6S2.5 16.5 2.5 15.1z"
        fill={theme.rim}
      />
      <path
        d="M2.5 12.2c0 1.4 4.2 2.6 9.5 2.6s9.5-1.2 9.5-2.6v2.9c0 1.4-4.2 2.6-9.5 2.6S2.5 16.5 2.5 15.1z"
        fill={theme.accent}
        opacity="0.85"
      />
      {/* lid */}
      <ellipse cx="12" cy="9.2" rx="9.5" ry="3.4" fill={theme.lid} />
      <ellipse cx="12" cy="9.2" rx="9.5" ry="3.4" fill="none" stroke={theme.lidEdge} strokeWidth="0.8" />
      {/* lid ring + highlight */}
      <ellipse cx="12" cy="9.2" rx="6.2" ry="2.1" fill="none" stroke={theme.accent} strokeWidth="0.9" opacity="0.9" />
      <ellipse cx="9.4" cy="8.1" rx="2.6" ry="0.8" fill="#ffffff" opacity="0.22" />
    </svg>
  );
}

/** Small can-shaped chip shown next to a leader who snuses */
export function SnusBadge({ productId, customLabel, className, showLabel = false, compact = false, isBrother = false }: SnusBadgeProps) {
  const product = getSnusProduct(productId);
  const label = snusLabel(productId, customLabel);
  const title = isBrother
    ? `Snus Brother${label ? `: ${label}` : ''}`
    : label ? `Snuser: ${label}` : 'Snuser';

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center align-middle',
          isBrother && 'rounded-full ring-1 ring-primary/60 p-[1px]',
          className
        )}
        title={title}
        aria-label={title}
      >
        <SnusCanIcon productId={productId} customLabel={customLabel} size={15} />
      </span>
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
      <SnusCanIcon productId={productId} customLabel={customLabel} size={14} />
      {showLabel && label ? <span className="max-w-[120px] truncate">{label}</span> : <span>Snus</span>}
    </span>
  );
}
