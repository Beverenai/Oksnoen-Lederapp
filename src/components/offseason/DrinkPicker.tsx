import { DRINKS, DRINK_TYPES, type DrinkType, playDrinkSound } from '@/lib/drinkSounds';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { cn } from '@/lib/utils';

/**
 * «Min drikke» – lederen velger sin egen drikke én gang, og alle slurker
 * de gir vises og høres som den drikken.
 */
export function DrinkPicker({
  value,
  onChange,
  className,
}: {
  value: DrinkType;
  onChange: (drink: DrinkType) => void;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {DRINK_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => {
            hapticImpact('light');
            onChange(t);
            playDrinkSound(t);
          }}
          aria-pressed={value === t}
          className={cn(
            'flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition-all active:scale-[0.97]',
            value === t
              ? 'border-oks-gold bg-oks-gold/15 shadow-sm'
              : 'border-border/60 bg-card/70',
          )}
        >
          <span className="text-[26px] leading-none">{DRINKS[t].emoji}</span>
          <span className="text-[11.5px] font-bold leading-tight text-foreground">
            {DRINKS[t].label}
          </span>
        </button>
      ))}
    </div>
  );
}
