import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, ImageIcon, X, Sparkles } from 'lucide-react';
import { compressImage } from '@/lib/imageUtils';
import { isNativeCameraAvailable, takePhoto } from '@/lib/capacitorCamera';
import { uploadGjenglemtImage, useCreateItem, type GjenglemtPeriod } from '@/hooks/useGjenglemt';
import { useStatusPopup } from '@/hooks/useStatusPopup';

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
  const [notes, setNotes] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [bagLabel, setBagLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null); setPreview(null);
      setNotes('');
      setOwnerName('');
      setBagLabel('');
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

  const canSubmit = !!file && !!period && !submitting;

  const submit = async () => {
    if (!canSubmit || !file || !period) return;
    setSubmitting(true);
    try {
      const path = await uploadGjenglemtImage(period.slug, file);
      await createItem.mutateAsync({
        period_id: period.id,
        image_url: path,
        notes: notes.trim() || null,
        owner_name: ownerName.trim() || null,
        bag_label: bagLabel.trim() || null,
      });
      showSuccess('Lagret · AI analyserer i bakgrunnen');
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

          {/* Navn + Pose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Navn <span className="text-xs text-muted-foreground font-normal">(valgfritt)</span></Label>
              <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Hvis det står et navn" />
            </div>
            <div>
              <Label className="text-sm font-medium">Pose <span className="text-xs text-muted-foreground font-normal">(valgfritt)</span></Label>
              <Input value={bagLabel} onChange={e => setBagLabel(e.target.value)} placeholder="F.eks. 3" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-sm font-medium mb-1.5">Notater <span className="text-xs text-muted-foreground">(valgfritt)</span></div>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="F.eks. funnet ved badestranden tirsdag. Eier: Kari fra Kabin 4."
            />
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2 items-start">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>AI gjenkjenner automatisk plaggtype og farge fra bildet, slik at folk kan søke det opp.</div>
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