import { cn } from '@/lib/utils';
import { getSnusProduct, snusTheme, customSnusProduct, snusLabel } from '@/lib/snusCatalog';

interface SnusPuckProps {
  productId?: string | null;
  customLabel?: string | null;
  /** Diameter in px */
  size?: number;
  className?: string;
}

/**
 * Snusboksen sett rett ovenfra — en rund "puck" i produktets farger.
 * Brukes som ikon i den runde hurtigknapp-raden på hjem.
 */
export function SnusPuck({ productId, customLabel, size = 34, className }: SnusPuckProps) {
  const product = getSnusProduct(productId) ?? customSnusProduct(customLabel || 'Snus');
  const theme = snusTheme(product);
  const label = snusLabel(productId, customLabel) || 'Snus';

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn('shrink-0 drop-shadow-sm', className)}
      role="img"
      aria-label={label}
    >
      {/* ytre kant (boksens side) */}
      <circle cx="20" cy="20" r="19" fill={theme.rim} />
      <circle cx="20" cy="20.8" r="18.4" fill={theme.lidEdge} />
      {/* lokk */}
      <circle cx="20" cy="19.6" r="17" fill={theme.lid} />
      {/* trykk-ring */}
      <circle cx="20" cy="19.6" r="11.4" fill="none" stroke={theme.accent} strokeWidth="1.6" opacity="0.9" />
      <circle cx="20" cy="19.6" r="5.2" fill="none" stroke={theme.accent} strokeWidth="1" opacity="0.6" />
      {/* glans */}
      <ellipse cx="14.4" cy="12.4" rx="7.4" ry="3.4" fill="#ffffff" opacity="0.2" transform="rotate(-22 14.4 12.4)" />
    </svg>
  );
}
