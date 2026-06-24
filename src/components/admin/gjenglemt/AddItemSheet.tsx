import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, ImageIcon, X } from 'lucide-react';
import { COLORS, GARMENT_TYPES } from '@/lib/gjenglemtConstants';
import { compressImage } from '@/lib/imageUtils';
import { isNativeCameraAvailable, takePhoto } from '@/lib/capacitorCamera';
import { uploadGjenglemtImage, useCreateItem, type GjenglemtPeriod } from '@/hooks/useGjenglemt';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  period: GjenglemtPeriod | null;
}

export function AddItemSheet({ open, onOpenChange, period }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const createItem = useCreateItem();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [garment, setGarment] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [ownerName, setOwnerName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null); setPreview(null);
      setGarment(''); setColor('');
      setOwnerName(''); setComment('');
      setSubmitting(false);
    }
  }, [open]);

  const handleFile = async (raw: File) => {
    try {
      const compressed = await compressImage(raw);
      setFile(compressed);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch {
      showError('Kunne ikke laste bilde');
    }
  };

  const handleCamera = async () => {
    if (isNativeCameraAvailable()) {
      const photo = await takePhoto();
      if (photo) handleFile(photo);
    } else {
      document.getElementById('gjenglemt-file-input')?.click();
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const canSubmit = !!file && !!garment && !!color && !!period && !submitting;

  const submit = async () => {
    if (!canSubmit || !file || !period) return;
    setSubmitting(true);
    try {
      const path = await uploadGjenglemtImage(period.slug, file);
      await createItem.mutateAsync({
        period_id: period.id,
        image_url: path,
        garment_type: garment,
        color,
        owner_name: ownerName.trim() || null,
        comment: comment.trim() || null,
      });
      showSuccess('Lagret');
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? 'Kunne ikke lagre');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Nytt gjenglemt funn</SheetTitle>
          <SheetDescription>
            {period ? `Legges til i: ${period.name}` : 'Velg periode først'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Image */}
          <div>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Forhåndsvisning" className="w-full max-h-72 object-contain rounded-xl bg-muted" />
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1.5 border"
                  aria-label="Fjern bilde"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" onClick={handleCamera} className="flex-1 h-24 flex-col gap-1">
                  <Camera className="h-6 w-6" />
                  <span className="text-xs">Ta bilde</span>
                </Button>
                <Button type="button" variant="outline" onClick={() => document.getElementById('gjenglemt-file-input')?.click()} className="flex-1 h-24 flex-col gap-1">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs">Velg fra album</span>
                </Button>
              </div>
            )}
            <input id="gjenglemt-file-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileInput} />
          </div>

          {/* Garment */}
          <div>
            <div className="text-sm font-medium mb-2">Plagg <span className="text-destructive">*</span></div>
            <div className="flex flex-wrap gap-1.5">
              {GARMENT_TYPES.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGarment(g.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-colors',
                    garment === g.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="text-sm font-medium mb-2">Farge <span className="text-destructive">*</span></div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  aria-label={c.label}
                  className={cn(
                    'h-10 w-10 rounded-full border-2 transition-all',
                    color === c.value ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:scale-105',
                  )}
                  style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Owner */}
          <div>
            <div className="text-sm font-medium mb-1.5">Navn på eier <span className="text-xs text-muted-foreground">(privat – vises ikke offentlig)</span></div>
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="F.eks. Kari fra Kabin 4" />
          </div>

          {/* Comment */}
          <div>
            <div className="text-sm font-medium mb-1.5">Kommentar <span className="text-xs text-muted-foreground">(privat)</span></div>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="F.eks. funnet ved badestranden tirsdag" />
          </div>

          <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t">
            <Button onClick={submit} disabled={!canSubmit} className="w-full h-12 text-base">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Lagre funn'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}