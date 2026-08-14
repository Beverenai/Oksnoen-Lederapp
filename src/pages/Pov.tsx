import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Film, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';
import { DisposableCamera } from '@/components/pov/DisposableCamera';
import { PovGrid } from '@/components/pov/PovGrid';
import {
  usePovCurrentRoll,
  usePovPhotos,
  usePovRolls,
  usePovTakePhoto,
  usePovToggleReaction,
  type PovPhoto,
} from '@/hooks/usePov';
import { toast } from 'sonner';
import povHero from '@/assets/pov-hero.jpg.asset.json';

function countdown(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} d ${hours} t`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours} t ${mins} min`;
}

export default function Pov() {
  const { isAdmin, leader } = useAuth();
  const { showError } = useStatusPopup();
  const { data: roll, isLoading } = usePovCurrentRoll();
  const { data: rolls } = usePovRolls();
  const [viewRollId, setViewRollId] = useState<string | null>(null);
  const activeRollId = viewRollId ?? roll?.id;
  const { data: photos, isLoading: photosLoading } = usePovPhotos(
    activeRollId && (viewRollId || roll?.status === 'developed') ? activeRollId : undefined,
  );
  const takePhoto = usePovTakePhoto(roll?.id);
  const toggleReaction = usePovToggleReaction(activeRollId);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const autoOpened = useRef(false);

  // Ta deg rett inn i kameraet når du åpner POV (ingen ekstra trykk).
  useEffect(() => {
    if (autoOpened.current) return;
    if (roll?.status === 'open' && roll.my_shots_left > 0) {
      autoOpened.current = true;
      setCameraOpen(true);
    }
  }, [roll?.status, roll?.my_shots_left]);

  const developedRolls = useMemo(
    () => (rolls ?? []).filter((r) => r.status === 'developed'),
    [rolls],
  );

  const shown = useMemo(() => {
    const list = photos ?? [];
    if (filter === 'mine' && leader?.id) return list.filter((p) => p.leader_id === leader.id);
    return list;
  }, [photos, filter, leader?.id]);

  const handleCapture = async (blob: Blob) => {
    try {
      await takePhoto.mutateAsync(blob);
      toast.success('Klikk! Bildet er på filmen');
    } catch (e: any) {
      showError('Kunne ikke lagre bildet', e?.message ?? 'Prøv igjen');
      throw e;
    }
  };

  const reveal = countdown(roll?.reveal_at ?? null);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="oks-offseason-bg mx-auto -mx-4 w-full max-w-2xl space-y-6 px-4 pb-8 pt-1">
      <header className="relative mt-1 overflow-hidden rounded-[24px] border border-oks-gold/25 shadow-oks">
        <img
          src={povHero.url}
          alt="Øksnøen sommerleir"
          className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--oks-night-deep)/0.94)_0%,hsl(var(--oks-night-deep)/0.35)_55%,transparent_85%)]"
        />
        <div className="absolute inset-x-4 bottom-4">
          <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-oks-gold">
            Engangskamera
          </span>
          <h1 className="font-heading text-[26px] font-bold leading-tight text-oks-cream">
            Øksnøen POV
          </h1>
          <p className="mt-1 text-[11.5px] font-medium leading-snug text-oks-cream/70">
            Ingen forhåndsvisning – alt avsløres når filmen utvikles.
          </p>
        </div>
      </header>

      {!roll && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Film className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Ingen film er lagt i kameraet</p>
            <p className="text-xs text-muted-foreground">
              Admin starter en ny film når det skjer noe.
            </p>
          </CardContent>
        </Card>
      )}

      {roll?.status === 'open' && (
        <div className="overflow-hidden rounded-[24px] border border-oks-gold/25 bg-[linear-gradient(150deg,hsl(var(--oks-forest))_0%,hsl(var(--oks-night-deep))_100%)] p-4 text-oks-cream shadow-oks">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-oks-gold">
                Film i kameraet
              </div>
              <div className="truncate font-heading text-[17px] font-bold">{roll.title}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-oks-cream/60">
                <Clock className="h-3.5 w-3.5" />
                {reveal ? `Utvikles om ${reveal}` : 'Utvikles når admin sier stopp'}
              </div>
            </div>
            <div className="shrink-0 rounded-2xl bg-oks-cream/10 px-3.5 py-2 text-center">
              <div className="font-mono text-2xl leading-none text-oks-gold">
                {String(roll.my_shots_left).padStart(2, '0')}
              </div>
              <div className="mt-0.5 text-[9.5px] uppercase tracking-widest text-oks-cream/50">
                igjen
              </div>
            </div>
          </div>

          <Button
            className="mt-4 w-full rounded-2xl bg-[var(--gradient-oks-gold)] text-oks-red-deep hover:opacity-90"
            size="lg"
            disabled={roll.my_shots_left <= 0}
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="mr-2 h-5 w-5" />
            {roll.my_shots_left > 0 ? 'Ta bilde' : 'Filmen er full'}
          </Button>
          <p className="mt-3 text-center text-[11px] text-oks-cream/45">
            {roll.photo_count} bilder er tatt av gjengen så langt.
          </p>
        </div>
      )}

      {(roll?.status === 'developed' || viewRollId) && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {(rolls ?? []).find((r) => r.id === activeRollId)?.title ?? roll?.title}
            </div>
            <div className="flex rounded-full bg-muted p-0.5 text-xs">
              {(['all', 'mine'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-full px-3 py-1 font-medium',
                    filter === f
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground',
                  )}
                >
                  {f === 'all' ? 'Alle' : 'Mine'}
                </button>
              ))}
            </div>
          </div>

          {photosLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Ingen bilder her.
              </CardContent>
            </Card>
          ) : (
            <PovGrid
              photos={shown}
              isAdmin={!!isAdmin}
              onToggleReaction={(photo: PovPhoto) =>
                toggleReaction.mutate({ photoId: photo.id, on: !photo.reactedByMe })
              }
            />
          )}
        </>
      )}

      {developedRolls.length > 0 && (
        <section className="space-y-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tidligere filmer
          </div>
          <div className="flex flex-wrap gap-2">
            {developedRolls.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setViewRollId(r.id === activeRollId ? null : r.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium',
                  r.id === activeRollId
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground',
                )}
              >
                {r.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {cameraOpen &&
        roll?.status === 'open' &&
        createPortal(
          <DisposableCamera
            shotsLeft={roll.my_shots_left}
            busy={takePhoto.isPending}
            onCapture={handleCapture}
            onClose={() => setCameraOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}