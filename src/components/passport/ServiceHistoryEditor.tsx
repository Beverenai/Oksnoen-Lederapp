import { useMemo, useState } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  PERIOD_CODES,
  serviceYears,
  useLeaderServicePeriods,
} from '@/hooks/useLeaderServicePeriods';

/**
 * Compact year → periode picker shown on the first passport page.
 * A leader checks off which periods they worked, per year, from 2013 onward.
 */
export function ServiceHistoryEditor({
  leaderId,
  readOnly = false,
}: {
  leaderId: string | null | undefined;
  readOnly?: boolean;
}) {
  const years = useMemo(() => serviceYears(), []);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const { data: rows = [], isLoading, toggle } = useLeaderServicePeriods(leaderId);

  const byYear = useMemo(() => {
    const map = new Map<number, string[]>();
    rows.forEach(r => {
      const list = map.get(r.year) ?? [];
      list.push(r.period_code);
      map.set(r.year, list);
    });
    return map;
  }, [rows]);

  const handleToggle = async (year: number, code: string) => {
    if (readOnly) return;
    const key = `${year}-${code}`;
    setPending(key);
    try {
      await toggle(year, code);
    } catch (err: any) {
      toast.error('Kunne ikke lagre', { description: err?.message });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.24em] text-[#7a5a20] font-semibold">
          Tjenesteår
        </span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#7a5a20]" />}
      </div>

      <div className="max-h-[42vh] overflow-y-auto overscroll-contain pr-0.5 space-y-1">
        {years.map(year => {
          const selected = byYear.get(year) ?? [];
          const isOpen = openYear === year;
          return (
            <div
              key={year}
              className="rounded-md border border-[#3a2410]/15 bg-[#fffaf0]/60 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenYear(isOpen ? null : year)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-semibold text-[#3a2410] tabular-nums">
                    {year}
                  </span>
                  {selected.length > 0 && (
                    <span className="truncate text-[10px] text-[#7a0a0e] font-semibold">
                      {PERIOD_CODES.filter(c => selected.includes(c)).join(' · ')}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-[#7a5a20] transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {isOpen && (
                <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                  {PERIOD_CODES.map(code => {
                    const active = selected.includes(code);
                    const busy = pending === `${year}-${code}`;
                    return (
                      <button
                        key={code}
                        type="button"
                        disabled={readOnly || busy}
                        onClick={() => handleToggle(year, code)}
                        className={cn(
                          'relative h-7 rounded-md text-[11px] font-semibold border transition-colors',
                          active
                            ? 'bg-[#7a0a0e] text-[#f5ecd8] border-[#7a0a0e]'
                            : 'bg-transparent text-[#3a2410] border-[#3a2410]/25',
                          (readOnly || busy) && 'opacity-60',
                        )}
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                        ) : (
                          <>
                            {code}
                            {active && (
                              <Check className="absolute top-0.5 right-0.5 h-2.5 w-2.5" />
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <p className="text-[10px] text-[#3a2410]/55">
          Huk av perioder — stempler lages automatisk.
        </p>
      )}
    </div>
  );
}

export default ServiceHistoryEditor;