import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, Loader2, Receipt, Undo2 } from 'lucide-react';

export type KioskSuccessData = {
  saleId: string;
  participantName: string;
  participantRoom: string | null;
  participantImage?: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number }>;
  total: number;
  remaining: number | null;
};

type Props = {
  data: KioskSuccessData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUndo: () => void;
  onShowReceipt: () => void;
  undoing?: boolean;
};

/** Confirmation shown right after a kiosk sale: who bought what and what is left. */
export const KioskSuccessDialog = ({
  data,
  open,
  onOpenChange,
  onUndo,
  onShowReceipt,
  undoing,
}: Props) => {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="flex flex-col items-center gap-3 bg-primary/10 px-6 pb-5 pt-7">
          <div className="relative">
            <Avatar className="h-20 w-20 border-2 border-background shadow-lg">
              <AvatarImage src={data.participantImage} alt={data.participantName} />
              <AvatarFallback className="text-lg">
                {data.participantName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
              <Check className="h-4 w-4" />
            </span>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold leading-tight">{data.participantName}</p>
            {data.participantRoom && (
              <p className="text-xs text-muted-foreground">{data.participantRoom}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5 px-6 py-4">
          {data.items.map((i) => (
            <div key={i.product_name} className="flex items-center justify-between text-sm">
              <span className="truncate pr-2">
                <span className="text-muted-foreground">{i.quantity}× </span>
                {i.product_name}
              </span>
              <span className="tabular-nums">{i.unit_price * i.quantity} kr</span>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>Brukt</span>
            <span className="tabular-nums">{data.total} kr</span>
          </div>
          {data.remaining !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Igjen på konto</span>
              <span
                className={
                  data.remaining < 0
                    ? 'font-semibold tabular-nums text-destructive'
                    : 'font-semibold tabular-nums'
                }
              >
                {data.remaining} kr
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t bg-muted/30 px-4 py-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onUndo}
              disabled={undoing}
            >
              {undoing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Angre
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Fortsett
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onShowReceipt}>
            <Receipt className="mr-2 h-4 w-4" />
            Vis kvittering
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};