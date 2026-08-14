import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Camera, Film, Sparkles, Lock, Unlock } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { usePovAdminActions, usePovPhotos, usePovRolls } from '@/hooks/usePov';
import { PovGrid } from '@/components/pov/PovGrid';

const statusLabel: Record<string, string> = {
  open: 'Åpen',
  developed: 'Utviklet',
  closed: 'Lukket',
};

export function PovTab() {
  const { showSuccess, showError } = useStatusPopup();
  const { data: rolls, isLoading } = usePovRolls();
  const { createRoll, developRoll, setStatus, togglePhotoHidden, deletePhoto } =
    usePovAdminActions();
  const [title, setTitle] = useState('');
  const [shots, setShots] = useState('10');
  const [revealAt, setRevealAt] = useState('');
  const [openRollId, setOpenRollId] = useState<string | null>(null);
  const { data: photos } = usePovPhotos(openRollId ?? undefined);

  const create = async () => {
    if (title.trim().length < 2) {
      showError('Mangler tittel', 'Gi filmen et navn');
      return;
    }
    try {
      await createRoll.mutateAsync({
        title: title.trim(),
        shots: Math.min(Math.max(parseInt(shots, 10) || 10, 1), 100),
        revealAt: revealAt ? new Date(revealAt).toISOString() : null,
      });
      setTitle('');
      setRevealAt('');
      showSuccess('Ny film lagt i kameraet');
    } catch (e: any) {
      showError('Kunne ikke lage film', e?.message ?? 'Prøv igjen');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Ny POV-film
          </CardTitle>
          <CardDescription>
            Ledere tar bilder uten forhåndsvisning. Bildene blir synlige for alle først når filmen
            utvikles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pov-title">Navn på filmen</Label>
            <Input
              id="pov-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vinterfest 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pov-shots">Bilder per leder</Label>
              <Input
                id="pov-shots"
                type="number"
                min={1}
                max={100}
                value={shots}
                onChange={(e) => setShots(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pov-reveal">Utvikles (valgfritt)</Label>
              <Input
                id="pov-reveal"
                type="datetime-local"
                value={revealAt}
                onChange={(e) => setRevealAt(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={create} disabled={createRoll.isPending} className="w-full">
            <Film className="mr-2 h-4 w-4" />
            Legg inn ny film
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filmer</CardTitle>
          <CardDescription>Utvikle, lukke eller åpne filmer igjen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Laster…</p>}
          {!isLoading && (rolls ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen filmer laget ennå.</p>
          )}
          {(rolls ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.title}</span>
                    <Badge variant={r.status === 'open' ? 'default' : 'secondary'}>
                      {statusLabel[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.shots_per_leader} bilder per leder
                    {r.reveal_at
                      ? ` • utvikles ${new Date(r.reveal_at).toLocaleString('nb-NO')}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== 'developed' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        developRoll
                          .mutateAsync(r.id)
                          .then(() => showSuccess('Filmen er utviklet'))
                          .catch((e: any) => showError('Feil', e?.message ?? 'Prøv igjen'))
                      }
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Utvikle nå
                    </Button>
                  )}
                  {r.status === 'open' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ rollId: r.id, status: 'closed' })}
                    >
                      <Lock className="mr-1.5 h-4 w-4" />
                      Lukk
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ rollId: r.id, status: 'open' })}
                    >
                      <Unlock className="mr-1.5 h-4 w-4" />
                      Åpne
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenRollId((id) => (id === r.id ? null : r.id))}
                  >
                    {openRollId === r.id ? 'Skjul bilder' : 'Se bilder'}
                  </Button>
                </div>
              </div>

              {openRollId === r.id && (
                <div className="mt-3">
                  {(photos ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ingen bilder på denne filmen.</p>
                  ) : (
                    <PovGrid
                      photos={photos ?? []}
                      isAdmin
                      onToggleReaction={() => {}}
                      onHide={(p) => togglePhotoHidden.mutate({ photoId: p.id, hidden: !p.hidden })}
                      onDelete={(p) =>
                        deletePhoto.mutate({ id: p.id, storage_path: p.storage_path })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}