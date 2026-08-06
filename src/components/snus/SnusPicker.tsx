import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnusCan3D } from './SnusCan3D';
import { SNUS_CATALOG, SNUS_BRANDS, searchSnus, getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';

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
  const [index, setIndex] = useState(0);

  const list = useMemo(() => {
    const base = searchSnus(query);
    const filtered = brand ? base.filter((p) => p.brand === brand) : base;
    return filtered.length > 0 ? filtered : SNUS_CATALOG;
  }, [query, brand]);

  // Keep the visible can in range, and start on the already selected one
  useEffect(() => {
    const idx = list.findIndex((p) => p.id === selectedId);
    setIndex(idx >= 0 ? idx : 0);
  }, [list, selectedId]);

  const safeIndex = Math.min(index, list.length - 1);
  const current = list[safeIndex];

  const step = (dir: 1 | -1) =>
    setIndex((i) => (Math.min(i, list.length - 1) + dir + list.length) % list.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center text-2xl font-heading">Velg snus</SheetTitle>
        </SheetHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søk merke, nummer, smak eller format…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            className="pl-9"
          />
        </div>

        {!customMode && (
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <BrandChip label="Alle" active={!brand} onClick={() => setBrand(null)} />
            {SNUS_BRANDS.map((g) => (
              <BrandChip
                key={g.brand}
                label={g.brand}
                active={brand === g.brand}
                onClick={() => {
                  setBrand(brand === g.brand ? null : g.brand);
                  setIndex(0);
                }}
              />
            ))}
          </div>
        )}

        {customMode ? (
          <div className="space-y-4">
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
            <div className="flex justify-center">
              <SnusCan3D product={current} size={270} onSwipe={step} />
            </div>

            <p className="mt-2 text-center text-base font-semibold">
              {current.brand} {current.variant}
            </p>

            <div className="mt-3 max-h-52 overflow-y-auto rounded-2xl border border-border">
              {list.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    i === safeIndex ? 'bg-muted font-semibold' : 'hover:bg-muted/50'
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.accent }} />
                  <span className="flex-1 truncate">
                    {p.brand} {p.variant}
                  </span>
                  {p.id === selectedId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCustomMode(true)}
              className="mx-auto mt-4 block text-sm text-muted-foreground underline decoration-dotted"
            >
              Finner du ikke din snus?
            </button>

            <Button
              size="lg"
              className="mt-4 w-full rounded-full"
              onClick={() => {
                onSelect(current.id, null);
                onOpenChange(false);
              }}
            >
              Velg denne
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
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
