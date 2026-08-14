import { IdCard, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { hapticImpact } from '@/lib/capacitorHaptics';
import type { Leader } from '@/types/database';

/** Lederpasset som et bokbind-bånd i rødt bokklede med gullkant. */
export function LederpassStrip({
  leader,
  periodLabel,
}: {
  leader: Leader | null | undefined;
  periodLabel?: string | null;
}) {
  const navigate = useNavigate();
  const role = leader?.ministerpost || 'Leder';
  const initials = (leader?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <button
      type="button"
      onClick={() => {
        hapticImpact('medium');
        navigate('/lederpass');
      }}
      aria-label="Åpne lederpasset"
      className="oks-bookcloth oks-grain relative flex w-full items-center gap-3 overflow-hidden rounded-[16px] border border-oks-gold/45 p-3 text-left shadow-oks transition-transform active:scale-[0.99]"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-oks-gold/50" />
      {leader?.profile_image_url ? (
        <img
          src={leader.profile_image_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full border-2 border-oks-gold/70 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-oks-gold/70 bg-oks-red-deep font-heading text-sm font-bold text-oks-cream">
          {initials}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.24em] text-oks-gold">
          <IdCard className="h-3 w-3" /> Ditt Lederpass
        </span>
        <span className="mt-0.5 block truncate font-heading text-[15px] font-bold text-oks-cream">
          {leader?.name || 'Leder'}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-oks-gold/45 bg-oks-gold/15 px-2 py-0.5 text-[10px] font-semibold text-oks-gold">
            {role}
          </span>
          {periodLabel && (
            <span className="rounded-full border border-oks-gold/45 bg-oks-gold/15 px-2 py-0.5 text-[10px] font-semibold text-oks-gold">
              {periodLabel}
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-oks-gold/80" />
    </button>
  );
}
