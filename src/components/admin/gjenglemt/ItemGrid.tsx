import { useState } from 'react';
import { CheckCircle2, Circle, Trash2, X, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { SignedImage } from './SignedImage';
import { colorMeta, garmentLabel } from '@/lib/gjenglemtConstants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDeleteItem, useReanalyzeItem, useUpdateItem, type GjenglemtItem } from '@/hooks/useGjenglemt';
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
  const reanalyze = useReanalyzeItem();
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
          const c = item.color ? colorMeta(item.color) : null;
          const isHentet = item.status === 'hentet';
          const aiPending = item.ai_status === 'pending';
          const aiFailed = item.ai_status === 'failed';
          return (
            <div key={item.id} className={cn('rounded-xl border overflow-hidden bg-card flex flex-col', isHentet && 'opacity-60')}>
              <button onClick={() => setLightbox(item)} className="relative aspect-square block bg-muted w-full">
                <SignedImage imageUrl={item.image_url} alt={item.garment_type ? garmentLabel(item.garment_type) : 'Gjenglemt'} className="w-full h-full object-cover" />
                {isHentet && (
                  <div className="absolute top-1.5 left-1.5"><Badge className="bg-green-600 text-white">Hentet</Badge></div>
                )}
                {aiPending && (
                  <div className="absolute top-1.5 right-1.5">
                    <Badge className="bg-primary/90 text-primary-foreground gap-1"><Sparkles className="h-3 w-3 animate-pulse" /> AI</Badge>
                  </div>
                )}
                {aiFailed && (
                  <div className="absolute top-1.5 right-1.5">
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Feilet</Badge>
                  </div>
                )}
              </button>
              <div className="p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {c && (
                    <span
                      className="h-4 w-4 rounded-full border shrink-0"
                      style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
                      aria-label={c.label}
                    />
                  )}
                  <span className="text-sm font-medium truncate">
                    {item.garment_type ? garmentLabel(item.garment_type) : (aiPending ? 'Analyserer…' : 'Ukjent')}
                  </span>
                </div>
                {item.ai_description && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{item.ai_description}</div>
                )}
                {item.notes && (
                  <div className="text-xs text-muted-foreground line-clamp-2 italic">📝 {item.notes}</div>
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
                    {aiFailed && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => reanalyze.mutate(item.id)} title="Analyser på nytt">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
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
            <SignedImage imageUrl={lightbox.image_url} alt={lightbox.garment_type ? garmentLabel(lightbox.garment_type) : 'Gjenglemt'} className="w-full max-h-[80dvh] object-contain rounded-xl" />
            <div className="mt-3 text-center space-y-1">
              <div className="font-medium">
                {lightbox.garment_type ? garmentLabel(lightbox.garment_type) : 'Ukjent'}
                {lightbox.color && ` – ${colorMeta(lightbox.color).label}`}
              </div>
              {lightbox.ai_description && <div className="text-sm text-muted-foreground">{lightbox.ai_description}</div>}
              {lightbox.notes && <div className="text-sm text-muted-foreground italic">📝 {lightbox.notes}</div>}
              {lightbox.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center pt-2">
                  {lightbox.ai_tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}