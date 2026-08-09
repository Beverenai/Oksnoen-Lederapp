import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { SnusCan3D } from './SnusCan3D';
import { getSnusProduct, customSnusProduct, snusFullName, type SnusProduct } from '@/lib/snusCatalog';

interface SnusCanRotatorProps {
  productIds?: (string | null)[] | null;
  customLabel?: string | null;
  size?: number;
  interactive?: boolean;
  /** ms per can */
  intervalMs?: number;
  className?: string;
  showLabel?: boolean;
}

export function snusProductsFrom(
  productIds?: (string | null)[] | null,
  customLabel?: string | null
): SnusProduct[] {
  const list = (productIds ?? [])
    .map((id) => getSnusProduct(id))
    .filter((p): p is SnusProduct => !!p);
  if (list.length > 0) return list;
  const label = customLabel?.trim();
  return label ? [customSnusProduct(label)] : [];
}

/** Viser flere snusbokser som roterer automatisk */
export function SnusCanRotator({
  productIds,
  customLabel,
  size = 220,
  interactive = true,
  intervalMs = 3200,
  className,
  showLabel = false,
}: SnusCanRotatorProps) {
  const products = snusProductsFrom(productIds, customLabel);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [products.length]);

  useEffect(() => {
    if (products.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % products.length), intervalMs);
    return () => clearInterval(t);
  }, [products.length, intervalMs]);

  if (products.length === 0) return null;
  const current = products[Math.min(index, products.length - 1)];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div key={current.id} className="animate-in fade-in zoom-in-95 duration-500">
        <SnusCan3D
          product={current}
          size={size}
          interactive={interactive}
          hideHint={products.length > 1}
          onSwipe={
            products.length > 1
              ? (dir) => setIndex((i) => (i + dir + products.length) % products.length)
              : undefined
          }
        />
      </div>

      {showLabel && (
        <p className="mt-1 text-center text-sm font-semibold">{snusFullName(current)}</p>
      )}

      {products.length > 1 && (
        <div className="mt-2 flex items-center gap-1.5">
          {products.map((p, i) => (
            <button
              key={p.id}
              aria-label={snusFullName(p)}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/40'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
