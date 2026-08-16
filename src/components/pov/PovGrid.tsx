import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Download, X, EyeOff, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { canSaveToPhotos, isShareAbort, savePhotoToDevice } from '@/lib/savePhoto';
import type { PovPhoto } from '@/hooks/usePov';

type Props = {
  photos: PovPhoto[];
  onToggleReaction: (photo: PovPhoto) => void;
  isAdmin?: boolean;
  onHide?: (photo: PovPhoto) => void;
  onDelete?: (photo: PovPhoto) => void;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PovGrid({ photos, onToggleReaction, isAdmin, onHide, onDelete }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null ? photos[openIndex] : null;
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const savePhoto = useCallback(async (photo: PovPhoto) => {
    if (!photo.signedUrl) return;
    setSaving(true);
    hapticImpact('light');
    try {
      const result = await savePhotoToDevice(photo.signedUrl, `oksnoen-pov-${photo.id}.jpg`);
      if (result === 'shared') toast.success('Velg «Lagre bilde» for å legge det i Bilder');
      else toast.success('Bildet er lastet ned');
    } catch (e) {
      if (!isShareAbort(e)) toast.error('Kunne ikke lagre bildet');
    } finally {
      setSaving(false);
    }
  }, []);

  const step = useCallback(
    (dir: -1 | 1) => {
      setOpenIndex((i) => {
        if (i === null) return i;
        const next = i + dir;
        if (next < 0 || next >= photos.length) return i;
        hapticImpact('light');
        return next;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Escape') setOpenIndex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, step]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => {
              hapticImpact('light');
              setOpenIndex(i);
            }}
            className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border/60 bg-muted"
          >
            {photo.signedUrl ? (
              <img
                src={photo.signedUrl}
                alt={`POV-bilde av ${photo.photographer}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-active:scale-[0.98]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                Bilde utilgjengelig
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
              <span className="truncate text-[10px] font-medium text-white/90">
                {photo.photographer}
              </span>
              {photo.reactions > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-white">
                  <Heart className="h-3 w-3 fill-current" />
                  {photo.reactions}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[75] flex flex-col bg-black/95">
          <div
            className="flex items-center justify-between px-4 pb-2 text-white"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="rounded-full bg-white/10 p-2"
              aria-label="Lukk bilde"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <div className="text-sm font-medium">{open.photographer}</div>
              <div className="text-[11px] text-white/50">
                {formatTime(open.taken_at)} · {(openIndex ?? 0) + 1}/{photos.length}
              </div>
            </div>
            {open.signedUrl ? (
              <button
                type="button"
                onClick={() => savePhoto(open)}
                disabled={saving}
                className="rounded-full bg-white/10 p-2 text-white disabled:opacity-50"
                aria-label={canSaveToPhotos() ? 'Lagre bilde i Bilder' : 'Last ned bilde'}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </button>
            ) : (
              <span className="w-9" />
            )}
          </div>

          <div
            className="relative flex flex-1 items-center justify-center px-3"
            onClick={() => setOpenIndex(null)}
            onTouchStart={(e) => {
              touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
              const start = touchRef.current;
              touchRef.current = null;
              if (!start) return;
              const dx = e.changedTouches[0].clientX - start.x;
              const dy = e.changedTouches[0].clientY - start.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
            }}
          >
            {open.signedUrl && (
              <img
                src={open.signedUrl}
                alt={`POV-bilde av ${open.photographer}`}
                className="max-h-full w-full rounded-2xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {(openIndex ?? 0) > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur"
                aria-label="Forrige bilde"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {(openIndex ?? 0) < photos.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur"
                aria-label="Neste bilde"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div
            className="flex items-center justify-center gap-3 px-4 pt-3"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                onToggleReaction(open);
              }}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
                open.reactedByMe ? 'bg-rose-500 text-white' : 'bg-white/10 text-white',
              )}
            >
              <Heart className={cn('h-4 w-4', open.reactedByMe && 'fill-current')} />
              {open.reactions}
            </button>
            {open.signedUrl && (
              <button
                type="button"
                onClick={() => savePhoto(open)}
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Lagre
              </button>
            )}
            {isAdmin && onHide && (
              <button
                type="button"
                onClick={() => onHide(open)}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white"
              >
                <EyeOff className="h-4 w-4" />
                Skjul
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(open);
                  setOpenIndex(null);
                }}
                className="flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Slett
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}