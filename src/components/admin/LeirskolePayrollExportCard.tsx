import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import {
  exportLeirskoleSeasonPayroll,
  exportLeirskoleWeekPayroll,
  type PayrollWeekInput,
} from '@/lib/exportLeirskolePayrollXlsx';

/**
 * Eksport av dager, økter og timer per leder — til regnskap og lønn.
 * Én uke, eller hele sesongen med ett ark per uke pluss totalsummer.
 */
export function LeirskolePayrollExportCard({
  week,
  allWeeks,
}: {
  week: PayrollWeekInput;
  allWeeks: PayrollWeekInput[];
}) {
  const [busy, setBusy] = useState<'week' | 'season' | null>(null);

  const run = async (kind: 'week' | 'season') => {
    setBusy(kind);
    try {
      if (kind === 'week') {
        const res = await exportLeirskoleWeekPayroll(week);
        toast.success(`Eksportert ${res.leaders} ledere og ${res.shifts} vakter`);
      } else {
        const res = await exportLeirskoleSeasonPayroll(allWeeks);
        toast.success(`Eksportert ${res.weeks} uker og ${res.leaders} ledere`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunne ikke lage eksporten');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-2xl bg-muted/40 p-3">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Excel-fil med dager, økter og timer per leder. Egne økter og kjøkkenvakt (8t) er med, og
          «Detaljer» viser hver enkelt vakt med aktivitet og beskjed.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-2xl"
          disabled={busy !== null}
          onClick={() => run('week')}
        >
          {busy === 'week' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="min-w-0 truncate text-left">
            Denne uken
            <span className="block text-[11px] font-normal text-muted-foreground">{week.name}</span>
          </span>
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-2xl"
          disabled={busy !== null || allWeeks.length === 0}
          onClick={() => run('season')}
        >
          {busy === 'season' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="min-w-0 truncate text-left">
            Hele sesongen
            <span className="block text-[11px] font-normal text-muted-foreground">{allWeeks.length} uker</span>
          </span>
        </Button>
      </div>
    </div>
  );
}
