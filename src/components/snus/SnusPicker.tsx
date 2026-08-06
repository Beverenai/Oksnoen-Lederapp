import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnusCan3D } from './SnusCan3D';
import { SNUS_CATALOG, searchSnus, getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';

interface SnusPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string | null;
  customLabel?: string | null;
  onSelect: (productId: string | null, customLabel: string | null) => void;
}

export function SnusPicker({ open, onOpenChange, selectedId, customLabel, onSelect }: SnusPickerProps) {
  const [query, setQuery] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(customLabel ?? '');

  const results = useMemo(() => searchSnus(query), [query]);
  const startIndex = useMemo(() => {
    const idx = results.findIndex((p) => p.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [results, selectedId]);
  const [index, setIndex] = useState(startIndex);

  const list = results.length > 0 ? results : SNUS_CATALOG;
  const safeIndex = Math.min(index, list.length - 1);
  const current = list[safeIndex];

  const step = (dir: number) => {
    setIndex((i) => {
      const next = (Math.min(i, list.length - 1) + dir + list.length) % list.length;
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center text-2xl font-heading">Velg snus</SheetTitle>
        </SheetHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søk merke, variant eller smak..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            className="pl-9"
          />
        </div>

        {customMode ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <SnusCan3D product={customSnusProduct(customValue || 'Egen snus')} size={220} />
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
            <div className="flex items-center justify-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Forrige">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <SnusCan3D product={current} size={230} />
              <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Neste">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
              <Row label={`${current.brand} ${current.variant}`} />
              <Row label={current.flavor} />
              <Row label={current.white ? 'Helhvit' : 'Brun / original'} />
              <Row label={`Styrke S${current.strength}`} accent={current.accent} />
            </div>

            <div className="mt-4 max-h-40 overflow-y-auto rounded-2xl border border-border">
              {list.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                    i === safeIndex ? 'bg-muted font-semibold' : 'hover:bg-muted/50'
                  )}
                >
                  <span className="truncate">
                    {p.brand} {p.variant}
                  </span>
                  {p.id === selectedId && <Check className="h-4 w-4 text-primary shrink-0" />}
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

function Row({ label, accent }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: accent ?? 'hsl(var(--primary))' }}
      />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

export { getSnusProduct };
