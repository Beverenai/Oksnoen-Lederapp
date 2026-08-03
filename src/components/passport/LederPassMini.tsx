import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLeaderServicePeriods } from '@/hooks/useLeaderServicePeriods';
import { PeriodStamp, type StampEntry } from './PeriodStamp';
import { hapticImpact } from '@/lib/capacitorHaptics';
import oksnoenLogo from '@/assets/oksnoen-logo.png';

interface LederPassMiniProps {
  leader: { id?: string; name?: string | null; ministerpost?: string | null; profile_image_url?: string | null } | null | undefined;
  periodLabel?: string | null;
  to?: string;
}

/**
 * Compact "mini pass" card — a prominent entry point to the full Lederpass.
 * Deliberately light-weight (no PassRail, no page virtualization).
 */
export function LederPassMini({ leader, periodLabel, to = '/lederpass' }: LederPassMiniProps) {
  const { data: servicePeriods = [] } = useLeaderServicePeriods(leader?.id);

  const previewStamps = useMemo<StampEntry[]>(() => {
    const seen = new Set<string>();
    return [...servicePeriods]
      .filter((r) => {
        const k = `${r.year}-${r.period_code}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.year - a.year)
      .slice(0, 3)
      .map((r) => ({ key: `${r.year}-${r.period_code}`, year: r.year, periodCode: String(r.period_code) }));
  }, [servicePeriods]);

  const name = leader?.name ?? 'Ukjent leder';
  const role = leader?.ministerpost || 'Leder';

  return (
    <NavLink
      to={to}
      onClick={() => hapticImpact('medium')}
      aria-label="Åpne lederpasset"
      className="block rounded-2xl overflow-hidden shadow-md active:scale-[0.99] transition-transform"
    >
      <div
        className="relative flex items-center gap-3 px-4 py-4"
        style={{
          background: 'linear-gradient(140deg, #7a0a0e 0%, #56060a 55%, #3a0407 100%)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-1.5 rounded-xl pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(240,205,120,0.45)' }}
        />

        <div
          className="relative w-14 h-14 rounded-full shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #b7212a, #6a0a10 70%)',
            boxShadow: 'inset 0 0 0 2px rgba(240,205,120,0.65), 0 3px 8px rgba(0,0,0,0.35)',
          }}
        >
          {leader?.profile_image_url ? (
            <img src={leader.profile_image_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <img src={oksnoenLogo} alt="" className="w-8 h-8 object-contain" />
          )}
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="text-[9px] tracking-[0.32em] font-semibold" style={{ color: '#f0cd78' }}>
            LEDERPASS
          </div>
          <div className="mt-0.5 text-base font-serif font-bold truncate" style={{ color: '#f7e6bd' }}>
            {name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span
              className="text-[9px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(240,205,120,0.18)', color: '#f0cd78' }}
            >
              {role}
            </span>
            {periodLabel && (
              <span
                className="text-[9px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(240,205,120,0.18)', color: '#f0cd78' }}
              >
                {periodLabel}
              </span>
            )}
            {servicePeriods.length > 0 && (
              <span className="text-[9px] tracking-[0.14em]" style={{ color: 'rgba(247,230,189,0.7)' }}>
                {servicePeriods.length} stempler
              </span>
            )}
          </div>
        </div>

        {previewStamps.length > 0 && (
          <div className="relative flex items-center -space-x-3 pr-1 shrink-0" aria-hidden>
            {previewStamps.map((entry, i) => (
              <PeriodStamp key={entry.key} entry={entry} size={40} animate={false} delayMs={i * 40} />
            ))}
          </div>
        )}

        <ChevronRight className="relative w-5 h-5 shrink-0" style={{ color: '#f0cd78' }} />
      </div>
    </NavLink>
  );
}
