import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Wand2 } from 'lucide-react';
import { shortDate } from '@/lib/leirskoleDates';
import type { LeirskolePreview } from '@/lib/leirskoleGenerateAll';

const MODE_TITLE: Record<string, string> = {
  all: 'Generer alt',
  schedule: 'Vaktplan fra ukeplanen',
  plan: 'Ny tilfeldig ukeplan',
};

/** Viser hva genereringen kommer til å endre — ingenting skrives før du bekrefter. */
export function LeirskoleGeneratePreviewDialog({
  preview,
  loading,
  running,
  onCancel,
  onConfirm,
}: {
  preview: LeirskolePreview | null;
  loading: boolean;
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = loading || !!preview;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {preview ? `Før vi kjører: ${MODE_TITLE[preview.mode] ?? 'Generering'}` : 'Beregner…'}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Sjekker uken…</p>}

        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xl font-bold tabular-nums">{preview.totals.cellsToFill}</p>
                <p className="text-xs text-muted-foreground">ruter fylles med aktiviteter</p>
              </div>
              <div className="rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xl font-bold tabular-nums">{preview.totals.shiftsAtRisk}</p>
                <p className="text-xs text-muted-foreground">vakter kan bli byttet ut</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 px-3 py-2">
                <p className="text-xl font-bold tabular-nums">{preview.totals.manualKept}</p>
                <p className="text-xs text-muted-foreground">manuelle valg beholdes</p>
              </div>
              <div className="rounded-2xl bg-sky-500/10 px-3 py-2">
                <p className="text-xl font-bold tabular-nums">{preview.totals.lockedDays}</p>
                <p className="text-xs text-muted-foreground">låste dager røres ikke</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60">
              {preview.days.map((d) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-sm last:border-0"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {d.locked && <Lock className="h-3.5 w-3.5 text-sky-500" />}
                    {shortDate(d.date)}
                    {d.special && <span className="text-xs text-amber-600">ankomst/avreise</span>}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {d.locked
                      ? 'beholdes urørt'
                      : [
                          d.cellsToFill ? `+${d.cellsToFill} ruter` : null,
                          d.existingShifts ? `${d.existingShifts} vakter kan endres` : null,
                          d.manualActivities ? `${d.manualActivities} manuelle beholdes` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'ingen endring'}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Etter kjøringen kan du angre alt med «Angre generering».
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="rounded-full" onClick={onCancel} disabled={running}>
                Avbryt
              </Button>
              <Button className="gap-2 rounded-full" onClick={onConfirm} disabled={running}>
                <Wand2 className="h-4 w-4" />
                {running ? 'Genererer…' : 'Kjør generering'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
