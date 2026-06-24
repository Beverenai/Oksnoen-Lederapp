import { useState } from 'react';
import { CheckCircle2, Circle, Trash2, X } from 'lucide-react';
import { SignedImage } from './SignedImage';
import { colorMeta, garmentLabel } from '@/lib/gjenglemtConstants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDeleteItem, useUpdateItem, type GjenglemtItem } from '@/hooks/useGjenglemt';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Props {
  items: GjenglemtItem[];
  canManageAll: boolean;
}

export function ItemGrid({ items, canManageAll }: Props) {
  const { effectiveLeader } = useAuth();
  const { showError, showSuccess } = useStatusPopup();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const [lightbox, setLightbox] = useState<GjenglemtItem | null>(null);

  const canEdit = (item: GjenglemtItem) =>
    canManageAll || item.created_by === effectiveLeader?.id;

  const toggleStatus = async (item: GjenglemtItem) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        status: item.status === 'hentet' ? 'uavhentet' : 'hentet',
      });
    } catch (e: any) { showError(e?.message ?? 'Kunne ikke oppdatere'); }
  };

  const remove = async (item: GjenglemtItem) => {
    if (!confirm('Slette denne?')) return;
    try { await deleteItem.mutateAsync(item); showSuccess('Slettet'); }
    catch (e: any) { showError(e?.message ?? 'Kunne ikke slette'); }
  };

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10 text-sm">
        Ingen treff. Trykk «Nytt funn» for å legge til.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map(item => {
          const c = colorMeta(item.color);
          const isHentet = item.status === 'hentet';
          return (
            <div key={item.id} className={cn('rounded-xl border overflow-hidden bg-card flex flex-col', isHentet && 'opacity-60')}>
              <button onClick={() => setLightbox(item)} className="relative aspect-square block bg-muted">
                <SignedImage imageUrl={item.image_url} alt={garmentLabel(item.garment_type)} className="w-full h-full object-cover" />
                {isHentet && (
                  <div className="absolute top-1.5 left-1.5"><Badge className="bg-green-600 text-white">Hentet</Badge></div>
                )}
              </button>
              <div className="p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-4 w-4 rounded-full border shrink-0"
                    style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
                    aria-label={c.label}
                  />
                  <span className="text-sm font-medium truncate">{garmentLabel(item.garment_type)}</span>
                </div>
                {item.owner_name && (
                  <div className="text-xs text-muted-foreground truncate">👤 {item.owner_name}</div>
                )}
                {item.comment && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{item.comment}</div>
                )}
                {canEdit(item) && (
                  <div className="flex gap-1 pt-1">
                    <Button
                      variant="outline" size="sm" className="flex-1 h-7 text-xs"
                      onClick={() => toggleStatus(item)}
                    >
                      {isHentet ? <Circle className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {isHentet ? 'Uavh.' : 'Hentet'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => remove(item)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 bg-background border rounded-full p-2" aria-label="Lukk" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <SignedImage imageUrl={lightbox.image_url} alt={garmentLabel(lightbox.garment_type)} className="w-full max-h-[80dvh] object-contain rounded-xl" />
            <div className="mt-3 text-center space-y-1">
              <div className="font-medium">{garmentLabel(lightbox.garment_type)} – {colorMeta(lightbox.color).label}</div>
              {lightbox.owner_name && <div className="text-sm text-muted-foreground">👤 {lightbox.owner_name}</div>}
              {lightbox.comment && <div className="text-sm text-muted-foreground">{lightbox.comment}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}