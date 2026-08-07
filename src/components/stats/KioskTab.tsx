import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Plus, Minus, Undo2, FileSpreadsheet, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParticipants } from '@/hooks/useParticipants';
import {
  useAddKioskDeposit,
  useKioskBalances,
  useKioskDeposits,
  useKioskSales,
  useVoidKioskSale,
} from '@/hooks/useKiosk';
import {
  balancesCsv,
  dailyCsv,
  depositsCsv,
  downloadCsv,
  productsCsv,
  salesCsv,
} from '@/lib/kioskExport';
import { KioskReceiptSheet } from '@/components/kiosk/KioskReceiptSheet';
import { receiptLabel, type ReceiptData } from '@/lib/kioskReceipt';

export function KioskTab() {
  const { data: participants = [], isLoading } = useParticipants();
  const { data: balances } = useKioskBalances();
  const { data: sales = [] } = useKioskSales();
  const { data: deposits = [] } = useKioskDeposits();
  const addDeposit = useAddKioskDeposit();
  const voidSale = useVoidKioskSale();
  const [search, setSearch] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? 'Ukjent';
  const stamp = new Date().toISOString().slice(0, 10);

  const exports = [
    { label: 'Alle kjøp (linjer)', file: `gomla-kjop-${stamp}.csv`, make: () => salesCsv(sales, nameOf) },
    { label: 'Varesalg', file: `gomla-varesalg-${stamp}.csv`, make: () => productsCsv(sales) },
    { label: 'Dagsrapport', file: `gomla-dagsrapport-${stamp}.csv`, make: () => dailyCsv(sales) },
    { label: 'Saldo per deltager', file: `gomla-saldo-${stamp}.csv`, make: () => balancesCsv(participants, balances) },
    { label: 'Innskudd og justeringer', file: `gomla-innskudd-${stamp}.csv`, make: () => depositsCsv(deposits, nameOf) },
  ];

  const openReceipt = (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;
    const p = participants.find((x) => x.id === sale.participant_id);
    setReceipt({
      saleId: sale.id,
      saleNumber: sale.sale_number,
      createdAt: sale.created_at,
      participantName: p?.name ?? 'Ukjent deltager',
      participantRoom: p?.cabins?.name ?? null,
      soldByName: sale.sold_by_name,
      items: sale.items,
      total: sale.total,
      balanceAfter: balances?.get(sale.participant_id)?.balance ?? null,
      voidedAt: sale.voided_at,
    });
    setReceiptOpen(true);
  };

  const totals = useMemo(() => {
    const active = sales.filter((s) => !s.voided_at);
    const revenue = active.reduce((sum, s) => sum + s.total, 0);
    const productCounts = new Map<string, { quantity: number; revenue: number }>();
    active.forEach((s) =>
      s.items.forEach((i) => {
        const cur = productCounts.get(i.product_name) || { quantity: 0, revenue: 0 };
        cur.quantity += i.quantity;
        cur.revenue += i.quantity * i.unit_price;
        productCounts.set(i.product_name, cur);
      })
    );
    const top = [...productCounts.entries()]
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 10);
    return { revenue, saleCount: active.length, top };
  }, [sales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? participants.filter((p) => p.name.toLowerCase().includes(q)) : participants;
    return list;
  }, [participants, search]);

  const adjust = async (participantId: string, sign: 1 | -1) => {
    const raw = Number(amounts[participantId]);
    if (!Number.isFinite(raw) || raw <= 0) {
      toast.error('Skriv inn et beløp');
      return;
    }
    try {
      await addDeposit.mutateAsync({ participantId, amount: raw * sign });
      setAmounts((prev) => ({ ...prev, [participantId]: '' }));
      toast.success(sign > 0 ? `+${raw} kr lagt til` : `${raw} kr trukket fra`);
    } catch (err: any) {
      toast.error('Kunne ikke oppdatere saldo', { description: err?.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Omsetning</p>
            <p className="text-2xl font-bold tabular-nums">{totals.revenue} kr</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Antall kjøp</p>
            <p className="text-2xl font-bold tabular-nums">{totals.saleCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mest solgt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {totals.top.map(([name, v]) => (
            <div key={name} className="flex items-center justify-between text-sm">
              <span className="min-w-0 truncate">{name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {v.quantity} stk · {v.revenue} kr
              </span>
            </div>
          ))}
          {totals.top.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Ingen salg ennå</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" />
            Rapporter
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {exports.map((e) => (
            <Button
              key={e.file}
              variant="outline"
              className="justify-start gap-2"
              onClick={() => downloadCsv(e.file, e.make())}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              {e.label}
            </Button>
          ))}
          <p className="col-span-full text-xs text-muted-foreground">
            CSV med semikolon — åpnes direkte i Excel og Google Sheets.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo per deltager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søk deltager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="divide-y divide-border">
            {filtered.map((p) => {
              const b = balances?.get(p.id);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Inn {b?.deposited ?? 0} kr · brukt {b?.spent ?? 0} kr
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
                      (b?.balance ?? 0) > 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-destructive/15 text-destructive'
                    )}
                  >
                    {b?.balance ?? 0} kr
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="kr"
                      value={amounts[p.id] ?? ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="h-8 w-16 tabular-nums"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => adjust(p.id, 1)}
                      aria-label="Legg til penger"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => adjust(p.id, -1)}
                      aria-label="Trekk fra penger"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Siste kjøp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sales.slice(0, 30).map((s) => {
            const p = participants.find((x) => x.id === s.participant_id);
            return (
              <div
                key={s.id}
                className={cn('flex items-start gap-2 border-b border-border pb-2 last:border-0', s.voided_at && 'opacity-50')}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p?.name || 'Ukjent'}{' '}
                    <span className="font-normal text-muted-foreground">
                      {receiptLabel({ saleNumber: s.sale_number, saleId: s.id })}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">{s.total} kr</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => openReceipt(s.id)}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Kvittering
                </Button>
                {s.voided_at ? (
                  <Badge variant="outline">Annullert</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-destructive"
                    onClick={() => voidSale.mutate(s.id)}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Annuller
                  </Button>
                )}
              </div>
            );
          })}
          {sales.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Ingen kjøp registrert</p>
          )}
        </CardContent>
      </Card>

      <KioskReceiptSheet receipt={receipt} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </div>
  );
}