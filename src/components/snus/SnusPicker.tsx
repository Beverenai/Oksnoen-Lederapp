import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnusCan3D } from './SnusCan3D';
import {
  SNUS_CATALOG,
  SNUS_BRANDS,
  searchSnus,
  getSnusProduct,
  customSnusProduct,
  type SnusProduct,
} from '@/lib/snusCatalog';
import logoAsset from '@/assets/oksnoen-header.png.asset.json';

interface SnusPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string | null;
  customLabel?: string | null;
  onSelect: (productId: string | null, customLabel: string | null) => void;
}

export function SnusPicker({ open, onOpenChange, selectedId, customLabel, onSelect }: SnusPickerProps) {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(customLabel ?? '');
  const [pickedId, setPickedId] = useState<string | null>(selectedId ?? null);

  const list = useMemo(() => {
    const base = searchSnus(query);
    const filtered = brand ? base.filter((p) => p.brand === brand) : base;
    return filtered.length > 0 ? filtered : SNUS_CATALOG;
  }, [query, brand]);

  // Start on the already selected can each time the sheet opens
  useEffect(() => {
    if (open) setPickedId(selectedId ?? null);
  }, [open, selectedId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[94dvh] flex-col gap-0 rounded-t-3xl p-0 sm:max-w-none"
      >
        {/* Sticky top: logo, title, search, brand chips */}
        <div className="shrink-0 px-4 pb-3 pt-5">
          <img
            src={logoAsset.url}
            alt="Øksnøen"
            className="mx-auto h-14 w-14 object-contain"
            loading="lazy"
          />
          <h2 className="mt-2 text-center font-heading text-2xl font-bold">Velg snusen din</h2>

          <div className="relative mt-3">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søk merke eller smak"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 rounded-full pl-11"
            />
          </div>

          {!customMode && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
              <BrandChip label="Alle" active={!brand} onClick={() => setBrand(null)} />
              {SNUS_BRANDS.map((g) => (
                <BrandChip
                  key={g.brand}
                  label={g.brand}
                  active={brand === g.brand}
                  onClick={() => setBrand(brand === g.brand ? null : g.brand)}
                />
              ))}
            </div>
          )}
        </div>

        {customMode ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            <div className="flex justify-center">
              <SnusCan3D product={customSnusProduct(customValue || 'Egen snus')} size={240} />
            </div>
            <Input
              placeholder="Skriv navnet på snusen din"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCustomMode(false)}>
                Tilbake til listen
              </Button>
              <Button
                className="flex-1"
                disabled={!customValue.trim()}
                onClick={() => {
                  onSelect(null, customValue.trim());
                  onOpenChange(false);
                }}
              >
                Lagre
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {list.map((p) => (
                  <CanCard
                    key={p.id}
                    product={p}
                    selected={p.id === pickedId}
                    onClick={() => setPickedId(p.id)}
                  />
                ))}
              </div>

              <button
                onClick={() => setCustomMode(true)}
                className="mx-auto mt-5 block text-sm text-muted-foreground underline decoration-dotted"
              >
                Finner du ikke din snus?
              </button>
            </div>

            <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                size="lg"
                className="w-full rounded-full text-base"
                disabled={!pickedId}
                onClick={() => {
                  if (!pickedId) return;
                  onSelect(pickedId, null);
                  onOpenChange(false);
                }}
              >
                Velg denne
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CanCard({
  product,
  selected,
  onClick,
}: {
  product: SnusProduct;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center pt-2 text-center">
      <div
        className={cn(
          'relative flex w-full items-center justify-center rounded-3xl px-1 py-2 transition-all',
          selected ? 'ring-2 ring-primary' : 'ring-1 ring-transparent'
        )}
      >
        <SnusCan3D product={product} size={140} interactive={false} spin={-24} />
        {selected && (
          <span className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </div>
      <span className="mt-1 line-clamp-2 text-sm font-semibold leading-tight">
        {product.brand} {product.variant}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">
        {product.flavor} • S{product.strength}
      </span>
    </button>
  );
}

function BrandChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
      )}
    >
      {label}
    </button>
  );
}

export { getSnusProduct };
