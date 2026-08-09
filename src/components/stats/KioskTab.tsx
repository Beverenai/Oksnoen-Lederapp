import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Loader2,
  Search,
  Plus,
  Minus,
  Undo2,
  FileSpreadsheet,
  Receipt,
  Wallet,
  ShoppingBasket,
  TrendingUp,
  Package,
  Users,
} from 'lucide-react';
import { cn, formatCabinRoom } from '@/lib/utils';
import { getParticipantThumb } from '@/lib/participantImage';
import { useParticipants } from '@/hooks/useParticipants';
import {
  useAddKioskDeposit,
  useKioskBalances,
  useKioskDeposits,
  useKioskSales,
  useKioskVisitCounts,
  useVoidKioskSale,
} from '@/hooks/useKiosk';
import {
  balancesCsv,
  dailyCsv,
  depositsCsv,
  downloadCsv,
  productsCsv,
  purchasingCsv,
  salesCsv,
} from '@/lib/kioskExport';
import { KioskReceiptSheet } from '@/components/kiosk/KioskReceiptSheet';
import { receiptLabel, type ReceiptData } from '@/lib/kioskReceipt';
import { useSeasonView } from '@/contexts/SeasonViewContext';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function KioskTab() {
  const { data: participants = [], isLoading } = useParticipants();
  const { data: balances } = useKioskBalances();
  const { data: sales = [] } = useKioskSales();
  const { data: deposits = [] } = useKioskDeposits();
  const { data: visitCounts } = useKioskVisitCounts();
  const addDeposit = useAddKioskDeposit();
  const voidSale = useVoidKioskSale();
  const { readOnly } = useSeasonView();
  const [search, setSearch] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const detail = useMemo(() => {
    if (!detailId) return null;
    const p = participants.find((x) => x.id === detailId);
    if (!p) return null;
    const mySales = sales.filter((s) => s.participant_id === detailId && !s.voided_at);
    const productMap = new Map<string, { quantity: number; revenue: number }>();
    mySales.forEach((s) =>
      s.items.forEach((i) => {
        const cur = productMap.get(i.product_name) || { quantity: 0, revenue: 0 };
        cur.quantity += i.quantity;
        cur.revenue += i.quantity * i.unit_price;
        productMap.set(i.product_name, cur);
      })
    );
    const products = [...productMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity);
    return {
      participant: p,
      sales: mySales,
      products,
      visits: mySales.length,
      spent: mySales.reduce((sum, s) => sum + s.total, 0),
    };
  }, [detailId, participants, sales]);

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? 'Ukjent';
  const stamp = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const active = sales.filter((s) => !s.voided_at);
    const revenue = active.reduce((sum, s) => sum + s.total, 0);
    const days = new Set(active.map((s) => new Date(s.created_at).toDateString()));
    const dayCount = Math.max(days.size, 1);

    const productMap = new Map<string, { quantity: number; revenue: number; price: number }>();
    active.forEach((s) =>
      s.items.forEach((i) => {
        const cur = productMap.get(i.product_name) || { quantity: 0, revenue: 0, price: i.unit_price };
        cur.quantity += i.quantity;
        cur.revenue += i.quantity * i.unit_price;
        cur.price = i.unit_price;
        productMap.set(i.product_name, cur);
      })
    );
    const products = [...productMap.entries()]
      .map(([name, v]) => ({
        name,
        ...v,
        perDay: v.quantity / dayCount,
        restock: Math.ceil((v.quantity / dayCount) * 7 * 1.2),
      }))
      .sort((a, b) => b.quantity - a.quantity);

    const byDay = new Map<string, { revenue: number; count: number }>();
    active.forEach((s) => {
      const key = new Date(s.created_at).toLocaleDateString('nb-NO');
      const cur = byDay.get(key) || { revenue: 0, count: 0 };
      cur.revenue += s.total;
      cur.count += 1;
      byDay.set(key, cur);
    });
    const daily = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

    const totalDeposited = [...(balances?.values() ?? [])].reduce((s, b) => s + b.deposited, 0);
    const totalLeft = [...(balances?.values() ?? [])].reduce((s, b) => s + b.balance, 0);
    const buyers = new Set(active.map((s) => s.participant_id)).size;
    const unitsSold = products.reduce((s, p) => s + p.quantity, 0);

    return {
      revenue,
      saleCount: active.length,
      dayCount,
      products,
      daily,
      totalDeposited,
      totalLeft,
      buyers,
      unitsSold,
      maxQty: products[0]?.quantity ?? 0,
    };
  }, [sales, balances]);

  const exports = [
    { label: 'Innkjøpsliste', desc: 'Salg per vare + anbefalt påfyll', file: `gomla-innkjop-${stamp}.csv`, make: () => purchasingCsv(sales, stats.dayCount) },
    { label: 'Varesalg', desc: 'Antall og omsetning per vare', file: `gomla-varesalg-${stamp}.csv`, make: () => productsCsv(sales) },
    { label: 'Alle kjøp (linjer)', desc: 'Full logg med varelinjer', file: `gomla-kjop-${stamp}.csv`, make: () => salesCsv(sales, nameOf) },
    { label: 'Dagsrapport', desc: 'Omsetning per dag', file: `gomla-dagsrapport-${stamp}.csv`, make: () => dailyCsv(sales) },
    { label: 'Saldo per deltager', desc: 'Innbetalt, brukt og rest', file: `gomla-saldo-${stamp}.csv`, make: () => balancesCsv(participants, balances) },
    { label: 'Innskudd og justeringer', desc: 'Alle endringer på saldo', file: `gomla-innskudd-${stamp}.csv`, make: () => depositsCsv(deposits, nameOf) },
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
      participantRoom: p ? formatCabinRoom(p.cabins?.name, p.room) : null,
      soldByName: sale.sold_by_name,
      items: sale.items,
      total: sale.total,
      balanceAfter: balances?.get(sale.participant_id)?.balance ?? null,
      voidedAt: sale.voided_at,
    });
    setReceiptOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? participants.filter((p) => p.name.toLowerCase().includes(q)) : participants;
    return [...list].sort((a, b) => {
      const ba = balances?.get(a.id)?.balance ?? 0;
      const bb = balances?.get(b.id)?.balance ?? 0;
      return ba - bb || a.name.localeCompare(b.name, 'nb');
    });
  }, [participants, search, balances]);

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Omsetning" value={`${stats.revenue} kr`} hint={`${stats.dayCount} salgsdager`} icon={TrendingUp} />
        <StatCard label="Antall kjøp" value={String(stats.saleCount)} hint={`${stats.unitsSold} varer solgt`} icon={ShoppingBasket} />
        <StatCard label="Innbetalt" value={`${stats.totalDeposited} kr`} hint={`${stats.totalLeft} kr står igjen`} icon={Wallet} />
        <StatCard label="Kjøpere" value={String(stats.buyers)} hint={`av ${participants.length} deltagere`} icon={Users} />
      </div>

      <Tabs defaultValue="varer">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="varer">Varesalg</TabsTrigger>
          <TabsTrigger value="saldo">Saldo</TabsTrigger>
          <TabsTrigger value="kjop">Kjøp</TabsTrigger>
          <TabsTrigger value="rapporter">Rapporter</TabsTrigger>
        </TabsList>

        {/* Varesalg / innkjøp */}
        <TabsContent value="varer" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Varesalg og innkjøpsbehov
              </CardTitle>
              <CardDescription>
                Snitt per dag og anbefalt påfyll for én uke (+20% buffer).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.products.map((p) => (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.quantity} stk · {p.revenue} kr
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${stats.maxQty ? (p.quantity / stats.maxQty) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {p.perDay.toFixed(1)} stk/dag · kjøp inn ca. {p.restock} stk til neste uke
                  </p>
                </div>
              ))}
              {stats.products.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Ingen salg ennå</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Omsetning per dag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {stats.daily.map(([day, v]) => (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span>{day}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {v.count} kjøp · {v.revenue} kr
                  </span>
                </div>
              ))}
              {stats.daily.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Ingen salg ennå</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saldo */}
        <TabsContent value="saldo" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saldo per deltager</CardTitle>
              <CardDescription>Laveste saldo først. Juster med + og −.</CardDescription>
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
                  const visits = visitCounts?.get(p.id) ?? 0;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={getParticipantThumb(p)} alt={p.name} loading="lazy" />
                        <AvatarFallback className="text-[10px]">{initials(p.name)}</AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={() => setDetailId(p.id)}
                        className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted"
                      >
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground tabular-nums">
                          Inn {b?.deposited ?? 0} kr · brukt {b?.spent ?? 0} kr · {visits} besøk
                        </p>
                      </button>
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
                          disabled={readOnly || addDeposit.isPending}
                          onClick={() => adjust(p.id, 1)}
                          aria-label="Legg til penger"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={readOnly || addDeposit.isPending}
                          onClick={() => adjust(p.id, -1)}
                          aria-label="Trekk fra penger"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Ingen treff</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kjøp */}
        <TabsContent value="kjop" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Siste kjøp</CardTitle>
              <CardDescription>Viser de 50 nyeste kvitteringene.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sales.slice(0, 50).map((s) => {
                const p = participants.find((x) => x.id === s.participant_id);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex flex-wrap items-center gap-2 border-b border-border pb-2 last:border-0',
                      s.voided_at && 'opacity-50'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={p ? getParticipantThumb(p) : undefined} alt={p?.name || ''} loading="lazy" />
                      <AvatarFallback className="text-[10px]">{initials(p?.name || '?')}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p?.name || 'Ukjent'}{' '}
                        <span className="font-normal text-muted-foreground">
                          {receiptLabel({ saleNumber: s.sale_number, saleId: s.id })}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
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
                    ) : readOnly ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-destructive"
                        disabled={voidSale.isPending}
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
        </TabsContent>

        {/* Rapporter */}
        <TabsContent value="rapporter" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" /> Rapporter
              </CardTitle>
              <CardDescription>
                CSV med semikolon — åpnes direkte i Excel og Google Sheets.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {exports.map((e) => (
                <button
                  key={e.file}
                  onClick={() => {
                    try {
                      downloadCsv(e.file, e.make());
                      toast.success(`${e.label} lastet ned`);
                    } catch (err: any) {
                      toast.error('Kunne ikke lage rapport', { description: err?.message });
                    }
                  }}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{e.label}</span>
                    <span className="block text-xs text-muted-foreground">{e.desc}</span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <KioskReceiptSheet receipt={receipt} open={receiptOpen} onOpenChange={setReceiptOpen} />

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getParticipantThumb(detail.participant)} alt={detail.participant.name} />
                    <AvatarFallback className="text-[10px]">{initials(detail.participant.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate">{detail.participant.name}</span>
                </DialogTitle>
                <DialogDescription className="tabular-nums">
                  {detail.visits} besøk i Gomla · brukt {detail.spent} kr · saldo{' '}
                  {balances?.get(detail.participant.id)?.balance ?? 0} kr
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold">Mest kjøpt</p>
                  <div className="divide-y divide-border rounded-lg border">
                    {detail.products.map((pr) => (
                      <div key={pr.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{pr.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {pr.quantity} stk · {pr.revenue} kr
                        </span>
                      </div>
                    ))}
                    {detail.products.length === 0 && (
                      <p className="px-3 py-3 text-sm text-muted-foreground">Ingen kjøp ennå</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Kjøpshistorikk ({detail.sales.length})</p>
                  <div className="space-y-2">
                    {detail.sales.map((s) => (
                      <div key={s.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleString('nb-NO', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {receiptLabel({ saleNumber: s.sale_number, saleId: s.id })}
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums">{s.total} kr</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 gap-1 px-2 text-xs"
                          onClick={() => openReceipt(s.id)}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Kvittering
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
