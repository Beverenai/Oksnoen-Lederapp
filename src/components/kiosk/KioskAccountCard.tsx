import { ShoppingBasket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKioskBalances, useKioskSales } from '@/hooks/useKiosk';

/** Kiosk balance and purchase history for a single participant. */
export function KioskAccountCard({ participantId }: { participantId: string }) {
  const { data: balances } = useKioskBalances();
  const { data: sales = [] } = useKioskSales(participantId);

  const b = balances?.get(participantId);
  if (!b && sales.length === 0) return null;

  const balance = b?.balance ?? 0;
  // Number of actual visits: completed (non-voided) purchases.
  const visits = sales.filter((s) => !s.voided_at).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShoppingBasket className="h-4 w-4 text-emerald-600" />
        <span>Gomla</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {visits} besøk
        </span>
        <span
          className={cn(
            'ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
            balance > 0
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/15 text-destructive'
          )}
        >
          {balance} kr igjen
        </span>
      </div>
      <div className="rounded-lg border bg-muted/40 p-2.5 text-sm">
        <p className="text-xs text-muted-foreground tabular-nums">
          Satt inn {b?.deposited ?? 0} kr · brukt {b?.spent ?? 0} kr
        </p>
        {sales.length > 0 && (
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {sales.map((s) => (
              <div
                key={s.id}
                className={cn('flex items-start gap-2 text-xs', s.voided_at && 'line-through opacity-50')}
              >
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {new Date(s.created_at).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {s.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{s.total} kr</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}