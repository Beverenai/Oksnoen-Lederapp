import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, CheckCheck, Hand, Loader2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useClaimParticipantTask,
  useCompleteParticipantTask,
  useMarkParticipantTaskRead,
  useMyParticipantTasks,
  useParticipantTasksRealtime,
} from '@/hooks/useParticipantTasks';

export function ParticipantTaskCards() {
  useParticipantTasksRealtime();
  const { leader, effectiveLeader } = useAuth();
  const leaderId = effectiveLeader?.id ?? leader?.id ?? null;
  const { data: tasks = [] } = useMyParticipantTasks();
  const markRead = useMarkParticipantTaskRead();
  const claim = useClaimParticipantTask();
  const complete = useCompleteParticipantTask();
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const mine = task.claimed_by === leaderId;
        const img = task.participant?.image_thumb_url || task.participant?.image_url || undefined;
        return (
          <Card key={task.id} className="border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-md">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => img && setLightbox({ url: task.participant?.image_url || img, name: task.participant?.name ?? 'Deltaker' })}
                  disabled={!img}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-default"
                  aria-label={img ? 'Forstørre bilde' : 'Ingen bilde'}
                >
                  <Avatar className="h-14 w-14 border-2 border-primary/30">
                    <AvatarImage src={img} alt={task.participant?.name ?? 'Deltaker'} />
                    <AvatarFallback>
                      <UserRound className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary/70 font-medium">
                    {task.is_broadcast ? 'Oppdrag til alle' : 'Beskjed til deg'}
                  </p>
                  <p className="font-heading font-bold text-lg leading-tight truncate">
                    {task.participant?.name ?? 'Deltaker'}
                  </p>
                </div>
              </div>

              <p className="text-base text-foreground whitespace-pre-wrap">{task.message}</p>

              {!task.is_broadcast && (
                <Button
                  className="w-full"
                  disabled={markRead.isPending}
                  onClick={() =>
                    markRead.mutate(task.id, {
                      onSuccess: () => toast.success('Beskjeden er markert som lest'),
                      onError: () => toast.error('Kunne ikke lagre'),
                    })
                  }
                >
                  {markRead.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  Du har lest beskjeden
                </Button>
              )}

              {task.is_broadcast && !mine && (
                <Button
                  className="w-full"
                  disabled={claim.isPending}
                  onClick={() =>
                    claim.mutate(task.id, {
                      onSuccess: (ok) =>
                        ok
                          ? toast.success('Du tok oppdraget')
                          : toast.info('En annen leder tok oppdraget først'),
                      onError: () => toast.error('Kunne ikke ta oppdraget'),
                    })
                  }
                >
                  {claim.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Hand className="h-4 w-4 mr-2" />
                  )}
                  Jeg fikser det
                </Button>
              )}

              {task.is_broadcast && mine && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Du har tatt dette oppdraget.</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={complete.isPending}
                    onClick={() =>
                      complete.mutate(task.id, {
                        onSuccess: () => toast.success('Oppdraget er ferdig'),
                        onError: () => toast.error('Kunne ikke lagre'),
                      })
                    }
                  >
                    {complete.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Ferdig
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}