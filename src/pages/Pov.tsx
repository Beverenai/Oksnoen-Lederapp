import { useMemo, useState } from 'react';
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
      <header className="oks-paper oks-paper-frame relative mt-1 overflow-hidden">
        <div className="oks-grain relative overflow-hidden rounded-[2px]">
          <img
            src={povHero.url}
            alt="Øksnøen sommerleir"
            className="aspect-[16/9] w-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-oks-night-deep/85 to-transparent" />
          <div className="absolute inset-x-3 bottom-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-oks-gold">
              Engangskamera
            </span>
            <h1 className="font-heading text-[24px] font-bold leading-tight text-oks-cream">
              Øksnøen POV
            </h1>
          </div>
        </div>
        <p className="absolute inset-x-3 bottom-1.5 text-[11px] font-semibold text-oks-night-deep/70">
          Ingen forhåndsvisning – alt avsløres når filmen utvikles.
        </p>
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
        <div className="overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-neutral-900 to-neutral-950 p-5 text-white shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300/70">
                Film i kameraet
              </div>
              <div className="text-lg font-semibold">{roll.title}</div>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
              <div className="font-mono text-xl text-amber-300">
                {String(roll.my_shots_left).padStart(2, '0')}
              </div>
              <div className="text-[10px] text-white/50">igjen</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
            <Clock className="h-3.5 w-3.5" />
            {reveal ? `Utvikles om ${reveal}` : 'Utvikles når admin sier stopp'}
          </div>

          <Button
            className="mt-4 w-full bg-amber-300 text-neutral-900 hover:bg-amber-200"
            size="lg"
            disabled={roll.my_shots_left <= 0}
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="mr-2 h-5 w-5" />
            {roll.my_shots_left > 0 ? 'Åpne kameraet' : 'Filmen er full'}
          </Button>
          <p className="mt-3 text-center text-[11px] text-white/40">
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