import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';

export type BentoTone = 'red' | 'navy' | 'gold' | 'sunset' | 'cream';
export type BentoSize = 'sm' | 'md' | 'lg';

const toneClass: Record<BentoTone, string> = {
  red: 'border-oks-red/25 bg-[var(--gradient-oks-red)] text-oks-cream',
  navy: 'border-oks-navy/25 bg-[var(--gradient-oks-navy)] text-oks-cream',
  sunset: 'border-oks-gold/30 bg-[var(--gradient-oks-sunset)] text-oks-cream',
  gold: 'border-oks-gold/40 bg-[var(--gradient-oks-gold)] text-oks-red-deep',
  cream: 'border-oks-red/12 bg-card/85 text-foreground backdrop-blur',
};

const iconWrapClass: Record<BentoTone, string> = {
  red: 'bg-oks-cream/15 text-oks-cream',
  navy: 'bg-oks-cream/15 text-oks-cream',
  sunset: 'bg-oks-cream/20 text-oks-cream',
  gold: 'bg-oks-red-deep/15 text-oks-red-deep',
  cream: 'bg-oks-red/10 text-oks-red',
};

const sizeClass: Record<BentoSize, string> = {
  sm: 'col-span-1 min-h-[104px] p-3.5',
  md: 'col-span-2 min-h-[104px] p-4',
  lg: 'col-span-2 min-h-[132px] p-4',
};

export type BentoTileProps = {
  icon: LucideIcon;
  label: string;
  desc?: string;
  tone?: BentoTone;
  size?: BentoSize;
  count?: number;
  dot?: boolean;
  locked?: boolean;
  visual?: ReactNode;
  onClick: () => void;
  className?: string;
};

/** Farget bento-flis brukt på off-season-flatene. */
export function BentoTile({
  icon: Icon,
  label,
  desc,
  tone = 'cream',
  size = 'sm',
  count,
  dot,
  visual,
  onClick,
  className,
}: BentoTileProps) {
  const wide = size !== 'sm';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        hapticImpact('light');
        onClick();
      }}
      className={cn(
        'relative flex overflow-hidden rounded-[22px] border text-left shadow-oks transition-transform active:scale-[0.98]',
        wide ? 'items-center gap-3.5' : 'flex-col justify-between gap-2.5',
        toneClass[tone],
        sizeClass[size],
        className,
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-2xl',
          iconWrapClass[tone],
          wide ? 'h-12 w-12' : 'h-10 w-10',
        )}
      >
        {visual ?? <Icon className={wide ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-heading font-bold leading-tight',
            wide ? 'text-[16px]' : 'text-[13.5px]',
          )}
        >
          {label}
        </span>
        {desc && (
          <span
            className={cn(
              'mt-0.5 block text-[11.5px] leading-snug',
              tone === 'cream' ? 'text-muted-foreground' : 'opacity-80',
            )}
          >
            {desc}
          </span>
        )}
      </span>
      {wide && <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-70" />}
      {count ? (
        <span className="absolute right-2.5 top-2.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
          {count > 99 ? '99+' : count}
        </span>
      ) : dot ? (
        <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background/70" />
      ) : null}
    </button>
  );
}