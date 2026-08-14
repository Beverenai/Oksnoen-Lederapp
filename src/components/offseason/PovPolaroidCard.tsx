import { Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePovCurrentRoll } from '@/hooks/usePov';
import povHero from '@/assets/pov-hero.jpg.asset.json';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { cn } from '@/lib/utils';

/**
 * POV som en polaroid-stabel i papir — hovedflisen off-season.
 */
export function PovPolaroidCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { data: roll } = usePovCurrentRoll();

  const total = roll?.shots_per_leader ?? 0;
  const left = roll?.my_shots_left ?? 0;
  const used = Math.max(0, total - left);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div className={cn('relative', className)}>
      {/* papirlag bak stabelen */}
      <span
        aria-hidden
        className="oks-paper absolute -left-1.5 top-2 h-full w-full rotate-[-2.2deg] rounded-[5px] opacity-60 shadow-oks"
      />
      <span
        aria-hidden
        className="oks-paper absolute left-2 top-1 h-full w-full rotate-[1.6deg] rounded-[5px] opacity-80 shadow-oks"
      />

      <button
        type="button"
        onClick={() => {
          hapticImpact('medium');
          navigate('/pov');
        }}
        className="oks-paper oks-paper-frame relative block w-full text-left transition-transform active:scale-[0.99]"
      >
        <span className="oks-grain relative block overflow-hidden rounded-[2px]">
          <img
            src={povHero.url}
            alt="Øksnøen POV"
            loading="lazy"
            className="aspect-[4/3] w-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-oks-night-deep/85 to-transparent" />
          <span className="absolute inset-x-3 bottom-2.5 block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-oks-gold">
              Engangskamera
            </span>
            <span className="mt-0.5 block font-heading text-[22px] font-bold leading-tight text-oks-cream">
              Øksnøen POV
            </span>
          </span>
          <span className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gradient-oks-gold)] text-oks-red-deep shadow-oks">
            <Camera className="h-4 w-4" strokeWidth={2.2} />
          </span>
        </span>

        <span className="relative mt-2.5 flex items-center gap-2.5 px-0.5 pb-0.5">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--oks-red)) ${pct}%, hsl(var(--oks-night-deep) / 0.12) ${pct}%)`,
              }}
            />
            <span className="oks-paper relative flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold">
              {left}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-oks-night-deep/70">
              {roll
                ? `${used} av ${total} bilder brukt`
                : 'Ingen film i kameraet'}
            </span>
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-oks-night-deep/12">
              <span
                className="block h-full rounded-full bg-[var(--gradient-oks-sunset)]"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-oks-red px-3 py-1.5 text-[11px] font-bold text-oks-cream">
            {roll && left > 0 ? 'Ta neste bilde' : 'Åpne POV'}
          </span>
        </span>
      </button>
    </div>
  );
}
