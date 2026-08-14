import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';

export type BentoTone = 'red' | 'navy' | 'gold' | 'sunset' | 'cream' | 'forest' | 'paper' | 'night';
export type BentoSize = 'sm' | 'md' | 'lg';

const toneClass: Record<BentoTone, string> = {
  red: 'border-oks-red/25 bg-[var(--gradient-oks-red)] text-oks-cream',
  navy: 'border-oks-navy/25 bg-[var(--gradient-oks-navy)] text-oks-cream',
  sunset: 'border-oks-gold/30 bg-[var(--gradient-oks-sunset)] text-oks-cream',
  gold: 'border-oks-gold/40 bg-[var(--gradient-oks-gold)] text-oks-red-deep',
  cream: 'border-oks-cream/12 bg-card/85 text-foreground backdrop-blur',
  forest:
    'border-oks-teal/25 bg-[linear-gradient(150deg,hsl(var(--oks-forest))_0%,hsl(var(--oks-night-deep))_100%)] text-oks-cream',
  night:
    'border-oks-cream/10 bg-[linear-gradient(150deg,hsl(210_40%_15%)_0%,hsl(var(--oks-night-deep))_100%)] text-oks-cream',
  paper: 'oks-paper border-oks-night-deep/15',
};

const iconWrapClass: Record<BentoTone, string> = {
  red: 'bg-oks-cream/15 text-oks-cream',
  navy: 'bg-oks-cream/15 text-oks-cream',
  sunset: 'bg-oks-cream/20 text-oks-cream',
  gold: 'bg-oks-red-deep/15 text-oks-red-deep',
  cream: 'bg-oks-cream/10 text-oks-gold',
  forest: 'bg-oks-teal/20 text-oks-cream',
  night: 'bg-oks-cream/10 text-oks-teal',
  paper: 'bg-oks-red/12 text-oks-red',
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
  /** Avrevet papirkant nederst — gir retro-preg */
  torn?: boolean;
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
  torn,
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
        'oks-grain relative flex overflow-hidden border text-left shadow-oks transition-transform active:scale-[0.98]',
        torn ? 'rounded-[6px] pb-6' : 'rounded-[22px]',
        wide ? 'items-center gap-3.5' : 'flex-col justify-between gap-2.5',
        toneClass[tone],
        sizeClass[size],
        className,
      )}
    >
      {torn && (
        <span
          aria-hidden
          className="oks-torn-strip pointer-events-none absolute inset-x-0 bottom-0 h-2.5 bg-oks-night-deep/70"
        />
      )}
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