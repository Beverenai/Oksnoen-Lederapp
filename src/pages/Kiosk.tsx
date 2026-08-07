import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  Undo2,
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
} from '@/hooks/useKiosk';
import { KioskParticipantPicker } from '@/components/kiosk/KioskParticipantPicker';

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  const categories = catalog?.categories ?? [];
  const products = catalog?.products ?? [];

  const visibleProducts = useMemo(
    () => (activeCategory ? products.filter((p) => p.category_id === activeCategory) : products),
    [products, activeCategory]
  );

  const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const balance = participant ? balances?.get(participant.id)?.balance ?? 0 : null;
  const remaining = balance === null ? null : balance - total;

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
      await recordSale.mutateAsync({ participantId: participant.id, lines });
      toast.success(`${total} kr registrert på ${participant.name}`);
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
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold">Kiosken</h1>
          <p className="text-xs text-muted-foreground">Registrer kjøp på deltagerens konto</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-1.5">
          <Receipt className="h-4 w-4" />
          Kvitteringer
        </Button>
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

      {/* Category chips */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:-mx-8 lg:px-8">
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

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {visibleProducts.map((p) => {
          const inCart = lines.find((l) => l.product.id === p.id)?.quantity ?? 0;
          const color = p.color || categories.find((c) => c.id === p.category_id)?.color;
          return (
            <button
              key={p.id}
              onClick={() => addLine(p)}
              style={color ? { backgroundColor: color } : undefined}
              className={cn(
                'relative flex min-h-[92px] flex-col justify-between rounded-2xl border border-border/60 p-3 text-left shadow-sm transition-transform active:scale-[0.97]',
                !color && 'bg-card'
              )}
            >
              <span className="pr-6 text-sm font-semibold leading-tight text-neutral-900">{p.name}</span>
              <span className="text-base font-bold tabular-nums text-neutral-900/80">{p.price} kr</span>
              {inCart > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-bold text-background">
                  {inCart}
                </span>
              )}
            </button>
          );
        })}
        {visibleProducts.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            Ingen varer i denne kategorien
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
        <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Siste kjøp</SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            {recentSales.map((sale) => {
              const p = participants.find((x) => x.id === sale.participant_id);
              return (
                <Card key={sale.id} className={cn('p-3', sale.voided_at && 'opacity-50')}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p?.name || 'Ukjent deltager'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('nb-NO', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sale.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular-nums">{sale.total} kr</span>
                      {sale.voided_at ? (
                        <Badge variant="outline">Annullert</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-destructive"
                          onClick={() => handleVoid(sale.id)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Annuller
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            {recentSales.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Ingen kjøp registrert ennå</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
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