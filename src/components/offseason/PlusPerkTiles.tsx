import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { PLUS_PERKS, type PlusPerk } from './plusPerks';

function PerkTile({
  perk,
  onLocked,
  className,
}: {
  perk: PlusPerk;
  onLocked: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const unlocked = !!perk.to;

  return (
    <button
      type="button"
      onClick={() => {
        hapticImpact('light');
        if (perk.to) navigate(perk.to);
        else onLocked();
      }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3 text-left transition-transform active:scale-[0.98]',
        unlocked
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/60 bg-card/40 opacity-90',
        className,
      )}
    >
      <span
        className={cn(
          'absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full',
          unlocked ? 'bg-primary/15' : 'bg-muted/70',
        )}
        aria-hidden
      >
        {unlocked ? (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        ) : (
          <Lock className="h-2.5 w-2.5 text-muted-foreground" />
        )}
      </span>
      <perk.icon
        className={cn('h-5 w-5', unlocked ? 'text-primary' : 'text-muted-foreground')}
        strokeWidth={2}
      />
      <p className="mt-2 pr-5 text-[12.5px] font-semibold leading-tight text-foreground">
        {perk.title}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
        {perk.desc}
      </p>
      <p className="mt-1.5 text-[9.5px] font-bold uppercase tracking-wide oks-gold-text">
        {unlocked ? 'Åpen nå' : 'Øksnøen +'}
      </p>
    </button>
  );
}

/**
 * Alle Øksnøen +-fordelene som fliser. Alt er ren moro og åpner paywallen,
 * bortsett fra fordeler med en ekte side (f.eks. Tinder for ledere).
 */
export function PlusPerkTiles({
  onLocked,
  variant = 'grid',
}: {
  onLocked: () => void;
  variant?: 'grid' | 'row';
}) {
  if (variant === 'row') {
    return (
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2.5">
          {PLUS_PERKS.map((perk) => (
            <PerkTile key={perk.key} perk={perk} onLocked={onLocked} className="w-[9.5rem] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {PLUS_PERKS.map((perk) => (
        <PerkTile key={perk.key} perk={perk} onLocked={onLocked} />
      ))}
    </div>
  );
}
