import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Printer, Download, Copy, Undo2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  downloadReceipt,
  formatReceiptDate,
  printReceipt,
  receiptLabel,
  receiptToText,
  type ReceiptData,
} from '@/lib/kioskReceipt';

interface Props {
  receipt: ReceiptData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoid?: (saleId: string) => void;
  justCompleted?: boolean;
}

/** Thermal-style receipt for a single Gomla sale. */
export function KioskReceiptSheet({ receipt, open, onOpenChange, onVoid, justCompleted }: Props) {
  if (!receipt) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptToText(receipt));
      toast.success('Kvittering kopiert');
    } catch {
      toast.error('Kunne ikke kopiere');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
        {justCompleted && (
          <div className="mx-auto mb-3 flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" strokeWidth={3} />
            Kjøpet er registrert
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-border bg-card p-5 font-mono text-sm shadow-sm">
            <p className="text-center font-heading text-lg font-bold tracking-[0.18em]">GOMLA</p>
            <p className="mb-3 text-center text-xs text-muted-foreground">Øksnøen leirsted</p>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Kvittering {receiptLabel(receipt)}</span>
              <span>{formatReceiptDate(receipt.createdAt)}</span>
            </div>

            <div className="my-3 border-t border-dashed border-border" />

            <p className="font-sans font-semibold">{receipt.participantName}</p>
            {receipt.participantRoom && (
              <p className="text-xs text-muted-foreground">{receipt.participantRoom}</p>
            )}

            <div className="my-3 border-t border-dashed border-border" />

            <div className="space-y-1">
              {receipt.items.map((i, idx) => (
                <div key={`${i.product_name}-${idx}`} className="flex gap-2">
                  <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{i.quantity}×</span>
                  <span className="min-w-0 flex-1 truncate">{i.product_name}</span>
                  <span className="shrink-0 tabular-nums">{i.quantity * i.unit_price} kr</span>
                </div>
              ))}
            </div>

            <div className="my-3 border-t border-dashed border-border" />

            <div className="flex justify-between text-base font-bold">
              <span>Totalt</span>
              <span className="tabular-nums">{receipt.total} kr</span>
            </div>
            {receipt.balanceAfter !== null && receipt.balanceAfter !== undefined && (
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Saldo etter kjøp</span>
                <span className="tabular-nums">{receipt.balanceAfter} kr</span>
              </div>
            )}
            {receipt.soldByName && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Selger</span>
                <span>{receipt.soldByName}</span>
              </div>
            )}
            {receipt.voidedAt && (
              <p className="mt-3 text-center text-sm font-bold tracking-[0.12em] text-destructive">
                ANNULLERT
              </p>
            )}
          </div>
        </div>

        <div className={cn('mt-4 grid gap-2', onVoid && !receipt.voidedAt ? 'grid-cols-4' : 'grid-cols-3')}>
          <Button variant="outline" className="flex-col gap-1 py-3 h-auto text-xs" onClick={() => printReceipt(receipt)}>
            <Printer className="h-4 w-4" />
            Skriv ut
          </Button>
          <Button variant="outline" className="flex-col gap-1 py-3 h-auto text-xs" onClick={() => downloadReceipt(receipt)}>
            <Download className="h-4 w-4" />
            Lagre
          </Button>
          <Button variant="outline" className="flex-col gap-1 py-3 h-auto text-xs" onClick={copy}>
            <Copy className="h-4 w-4" />
            Kopier
          </Button>
          {onVoid && !receipt.voidedAt && (
            <Button
              variant="outline"
              className="flex-col gap-1 py-3 h-auto text-xs text-destructive"
              onClick={() => onVoid(receipt.saleId)}
            >
              <Undo2 className="h-4 w-4" />
              Annuller
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}