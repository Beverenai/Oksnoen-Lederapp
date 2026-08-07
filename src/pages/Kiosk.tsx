import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Loader2,
  Minus,
  Plus,
  ShoppingBasket,
  Trash2,
  UserRound,
  X,
  Receipt,
  Search,
  ChevronRight,
} from 'lucide-react';
import { cn, formatFullRoom } from '@/lib/utils';
import { getParticipantThumb } from '@/lib/participantImage';
import { useParticipants, type ParticipantWithCabin } from '@/hooks/useParticipants';
import {
  useKioskBalances,
  useKioskCatalog,
  useKioskSales,
  useRecordKioskSale,
  useVoidKioskSale,
  type CartLine,
  type KioskProduct,
  type KioskSale,
} from '@/hooks/useKiosk';
import { supabase } from '@/integrations/supabase/client';
import { KioskParticipantPicker } from '@/components/kiosk/KioskParticipantPicker';
import { KioskReceiptSheet } from '@/components/kiosk/KioskReceiptSheet';
import { receiptLabel, type ReceiptData } from '@/lib/kioskReceipt';
import { getTileStyle } from '@/lib/kioskBrand';

const Kiosk = () => {
  const { data: participants = [], isLoading: participantsLoading } = useParticipants();
  const { data: catalog, isLoading: catalogLoading } = useKioskCatalog();
  const { data: balances } = useKioskBalances();
  const { data: recentSales = [] } = useKioskSales();
  const recordSale = useRecordKioskSale();
  const voidSale = useVoidKioskSale();

  const [participant, setParticipant] = useState<ParticipantWithCabin | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptIsNew, setReceiptIsNew] = useState(false);

  const categories = catalog?.categories ?? [];
  const products = catalog?.products ?? [];

  const visibleProducts = useMemo(() => {
    const order = new Map(categories.map((c, i) => [c.id, i]));
    const q = search.trim().toLowerCase();
    let list = activeCategory && !q
      ? products.filter((p) => p.category_id === activeCategory)
      : [...products];
    if (q) {
      list = list.filter((p) => {
        const cat = categories.find((c) => c.id === p.category_id)?.name ?? '';
        return p.name.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => {
      const ca = order.get(a.category_id ?? '') ?? 99;
      const cb = order.get(b.category_id ?? '') ?? 99;
      if (ca !== cb) return ca - cb;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.localeCompare(b.name, 'nb');
    });
  }, [products, categories, activeCategory, search]);

  const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const balance = participant ? balances?.get(participant.id)?.balance ?? 0 : null;
  const remaining = balance === null ? null : balance - total;

  const saleLabel = (s: KioskSale) => receiptLabel({ saleNumber: s.sale_number, saleId: s.id });

  const participantName = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? 'Ukjent deltager';

  const filteredSales = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return recentSales;
    return recentSales.filter(
      (s) =>
        participantName(s.participant_id).toLowerCase().includes(q) ||
        saleLabel(s).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentSales, historySearch, participants]);

  const toReceipt = (sale: KioskSale): ReceiptData => {
    const p = participants.find((x) => x.id === sale.participant_id);
    return {
      saleId: sale.id,
      saleNumber: sale.sale_number,
      createdAt: sale.created_at,
      participantName: p?.name ?? 'Ukjent deltager',
      participantRoom: p ? formatFullRoom(p.cabins?.name, p.room) : null,
      soldByName: sale.sold_by_name,
      items: sale.items,
      total: sale.total,
      balanceAfter: balances?.get(sale.participant_id)?.balance ?? null,
      voidedAt: sale.voided_at,
    };
  };

  const openReceipt = (sale: KioskSale) => {
    setReceipt(toReceipt(sale));
    setReceiptIsNew(false);
    setReceiptOpen(true);
  };

  const addLine = (product: KioskProduct) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const handleCheckout = async () => {
    if (!participant) {
      setPickerOpen(true);
      return;
    }
    if (lines.length === 0) return;
    try {
      const saleId = await recordSale.mutateAsync({ participantId: participant.id, lines });
      const { data } = await supabase
        .from('kiosk_sales')
        .select('sale_number, created_at, leaders!kiosk_sales_sold_by_fkey(name)')
        .eq('id', saleId)
        .maybeSingle();
      setReceipt({
        saleId,
        saleNumber: (data as any)?.sale_number ?? null,
        createdAt: (data as any)?.created_at ?? new Date().toISOString(),
        participantName: participant.name,
        participantRoom: formatFullRoom(participant.cabins?.name, participant.room),
        soldByName: (data as any)?.leaders?.name ?? null,
        items: lines.map((l) => ({
          product_name: l.product.name,
          unit_price: l.product.price,
          quantity: l.quantity,
        })),
        total,
        balanceAfter: remaining,
      });
      setReceiptIsNew(true);
      setReceiptOpen(true);
      setLines([]);
      setParticipant(null);
    } catch (err: any) {
      toast.error('Kunne ikke registrere kjøp', { description: err?.message });
    }
  };

  const handleVoid = async (saleId: string) => {
    try {
      await voidSale.mutateAsync(saleId);
      toast.success('Salget er annullert');
      setReceiptOpen(false);
    } catch (err: any) {
      toast.error('Kunne ikke annullere', { description: err?.message });
    }
  };

  if (catalogLoading || participantsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-40">
      {/* Sticky toolbar — uses the top of the screen, also on iPhone */}
      <div className="sticky top-[calc(56px+var(--safe-top))] z-30 -mx-4 -mt-4 mb-3 border-b border-border/60 bg-background/85 px-4 pb-2 pt-3 backdrop-blur-xl lg:-mx-6 lg:-mt-6 lg:top-0 lg:px-6">
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Søk vare…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-full pl-9 pr-9"
              />
              <button
                onClick={() => {
                  setSearch('');
                  setSearchOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground"
                aria-label="Lukk søk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="flex-1 font-heading text-xl font-bold leading-none">Gomla</h1>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={() => setSearchOpen(true)}
                aria-label="Søk vare"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={() => setHistoryOpen(true)}
                aria-label="Kvitteringer"
              >
                <Receipt className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Category chips */}
        {!search && (
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 lg:-mx-6 lg:px-6">
            <CategoryChip label="Alle" active={!activeCategory} onClick={() => setActiveCategory(null)} />
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected participant */}
      <Card
        onClick={() => setPickerOpen(true)}
        className="mb-3 cursor-pointer p-3 active:scale-[0.99] transition-transform"
      >
        {participant ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={getParticipantThumb(participant)} alt={participant.name} />
              <AvatarFallback className="text-xs">
                {participant.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{participant.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatFullRoom(participant.cabins?.name, participant.room) || 'Ingen hytte'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</p>
              <p
                className={cn(
                  'text-lg font-bold tabular-nums',
                  (balance ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                )}
              >
                {balance} kr
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setParticipant(null);
              }}
              aria-label="Fjern deltager"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Velg deltager</p>
              <p className="text-xs">Du kan også velge etter at varene er lagt inn</p>
            </div>
          </div>
        )}
      </Card>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {visibleProducts.map((p) => {
          const inCart = lines.find((l) => l.product.id === p.id)?.quantity ?? 0;
          const categoryName = categories.find((c) => c.id === p.category_id)?.name ?? null;
          const brand = getBrandMark(p.name, categoryName);
          return (
            <button
              key={p.id}
              onClick={() => addLine(p)}
              className={cn(
                'relative flex min-h-[104px] flex-col gap-1.5 overflow-hidden rounded-2xl border border-border/60 bg-card p-2.5 text-left shadow-sm transition-transform active:scale-[0.97]',
                inCart > 0 && 'ring-2 ring-primary'
              )}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-black leading-none shadow-sm"
                style={{ backgroundColor: brand.bg, color: brand.fg }}
              >
                {brand.emoji ?? brand.mark}
              </span>
              <span className="line-clamp-2 flex-1 pr-6 text-[13px] font-semibold leading-tight">
                {p.name}
              </span>
              <span className="text-sm font-bold tabular-nums text-muted-foreground">{p.price} kr</span>
              {inCart > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {inCart}
                </span>
              )}
            </button>
          );
        })}
        {visibleProducts.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            {search ? `Ingen treff på «${search}»` : 'Ingen varer i denne kategorien'}
          </p>
        )}
      </div>

      {/* Cart bar */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border/60 bg-background/85 p-3 shadow-lg backdrop-blur-xl">
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {lines.map((l) => (
                <div key={l.product.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{l.product.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => changeQuantity(l.product.id, -1)}
                      aria-label="Færre"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{l.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => changeQuantity(l.product.id, 1)}
                      aria-label="Flere"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums">
                    {l.product.price * l.quantity} kr
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-muted-foreground"
                onClick={() => setLines([])}
                aria-label="Tøm handlekurv"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold tabular-nums leading-tight">{total} kr</p>
                {remaining !== null && (
                  <p
                    className={cn(
                      'text-xs',
                      remaining < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    Igjen etter kjøp: {remaining} kr
                  </p>
                )}
              </div>
              <Button
                size="lg"
                className="shrink-0 gap-2 rounded-full"
                disabled={recordSale.isPending}
                onClick={handleCheckout}
              >
                {recordSale.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBasket className="h-4 w-4" />
                )}
                {participant ? 'Registrer' : 'Velg deltager'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <KioskParticipantPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        participants={participants}
        balances={balances}
        onSelect={setParticipant}
      />

      {/* Receipts */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="bottom" className="flex h-[88dvh] flex-col gap-0 rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Kvitteringer</SheetTitle>
          </SheetHeader>
          <div className="relative mt-3 shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søk navn eller kvitteringsnr."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            {filteredSales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => openReceipt(sale)}
                className="w-full text-left"
              >
                <Card
                  className={cn(
                    'flex items-center gap-2 p-3 transition-transform active:scale-[0.99]',
                    sale.voided_at && 'opacity-50'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {participantName(sale.participant_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {saleLabel(sale)} ·{' '}
                      {new Date(sale.created_at).toLocaleString('nb-NO', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {sale.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-bold tabular-nums">{sale.total} kr</span>
                    {sale.voided_at && <Badge variant="outline">Annullert</Badge>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Card>
              </button>
            ))}
            {filteredSales.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {historySearch ? 'Ingen treff' : 'Ingen kjøp registrert ennå'}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <KioskReceiptSheet
        receipt={receipt}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        onVoid={handleVoid}
        justCompleted={receiptIsNew}
      />
    </div>
  );
};

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-muted text-muted-foreground'
      )}
    >
      {label}
    </button>
  );
}

export default Kiosk;