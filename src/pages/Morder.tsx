import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Skull, Eye, EyeOff, Loader2, Crown, Hourglass, Ghost } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMyMurderState, useMurderMutations } from '@/hooks/useMurderGame';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { hapticImpact, hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import { useAuth } from '@/contexts/AuthContext';

export default function Morder() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useStatusPopup();
  const { effectiveLeader } = useAuth() as { effectiveLeader?: { id: string; name: string } | null };
  const { data: state, isLoading } = useMyMurderState();
  const { claimKill, confirmDeath } = useMurderMutations();
  const [revealed, setRevealed] = useState(false);
  const [confirmKillOpen, setConfirmKillOpen] = useState(false);
  const [confirmDeadOpen, setConfirmDeadOpen] = useState(false);

  const initials = (name: string | null) =>
    (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const handleClaim = async () => {
    try {
      await claimKill.mutateAsync();
      hapticSuccess();
      showSuccess('Drapet er meldt inn – venter på bekreftelse');
    } catch (e) {
      hapticError();
      showError(e instanceof Error ? e.message : 'Kunne ikke melde drapet');
    } finally {
      setConfirmKillOpen(false);
    }
  };

  const handleDead = async () => {
    try {
      await confirmDeath.mutateAsync(state?.incoming_claim_id ?? null);
      hapticSuccess();
      showSuccess('Bekreftet – du er ute av leken');
      setRevealed(false);
    } catch (e) {
      hapticError();
      showError(e instanceof Error ? e.message : 'Ingen ventende drapsmelding på deg');
    } finally {
      setConfirmDeadOpen(false);
    }
  };

  const isWinner = !!state && state.is_alive && state.winner_leader_id === (effectiveLeader?.id ?? '');

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
      <div className="flex items-center gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="-ml-2 hidden lg:inline-flex">
          <ArrowLeft className="w-4 h-4 mr-1" /> Hjem
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Skull className="w-6 h-6 text-destructive" /> Morder-leken
        </h1>
        <p className="text-sm text-muted-foreground">
          Ta ut målet ditt i det stille. Når målet ditt er ute, arver du deres mål.
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-52 w-full rounded-2xl" />
      ) : !state ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Ghost className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Du er ikke med i leken</p>
            <p className="text-sm text-muted-foreground">
              Spillet er ikke startet, eller admin har tatt deg ut av deltakerlisten.
            </p>
          </CardContent>
        </Card>
      ) : !state.is_active ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Hourglass className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Leken er satt på pause</p>
            <p className="text-sm text-muted-foreground">Admin har slått av Morder-leken.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{state.kills} drap</Badge>
            {!state.is_alive && <Badge variant="destructive">Du er ute</Badge>}
          </div>

          {!state.is_alive ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="py-10 text-center space-y-2">
                <Skull className="w-12 h-12 mx-auto text-destructive" />
                <p className="text-lg font-semibold">Du er drept</p>
                <p className="text-sm text-muted-foreground">
                  {state.killed_by_name ? `Du ble tatt av ${state.killed_by_name}.` : 'Du er ute av leken.'}
                </p>
              </CardContent>
            </Card>
          ) : isWinner ? (
            <Card className="border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20">
              <CardContent className="py-10 text-center space-y-2">
                <Crown className="w-12 h-12 mx-auto text-amber-500" />
                <p className="text-lg font-semibold">Du vant Morder-leken!</p>
                <p className="text-sm text-muted-foreground">Siste morder som står igjen.</p>
              </CardContent>
            </Card>
          ) : state.pending_claim_id ? (
            <Card className="border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20">
              <CardContent className="py-8 text-center space-y-2">
                <Hourglass className="w-10 h-10 mx-auto text-amber-500 animate-pulse" />
                <p className="font-semibold">Venter på bekreftelse</p>
                <p className="text-sm text-muted-foreground">
                  {state.pending_claim_victim_name} må trykke «Jeg har blitt drept» før du får nytt mål.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="py-8 space-y-5">
                <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
                  Ditt mål
                </p>

                {revealed && state.target_name ? (
                  <div className="flex flex-col items-center gap-3 animate-fade-in">
                    <Avatar className="w-24 h-24 ring-2 ring-destructive/40">
                      <AvatarImage src={state.target_image_url ?? undefined} alt={state.target_name} />
                      <AvatarFallback>{initials(state.target_name)}</AvatarFallback>
                    </Avatar>
                    <p className="text-2xl font-heading font-bold text-center">{state.target_name}</p>
                    <Button variant="ghost" size="sm" onClick={() => setRevealed(false)}>
                      <EyeOff className="w-4 h-4 mr-1" /> Skjul
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                      <Skull className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <Button
                      size="lg"
                      onClick={() => { hapticImpact('medium'); setRevealed(true); }}
                      disabled={!state.target_name}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {state.target_name ? 'Reveal målet' : 'Ingen mål ennå'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {state.is_alive && !isWinner && (
            <div className="space-y-2">
              <Button
                className="w-full h-12"
                variant="destructive"
                disabled={!state.target_leader_id || !!state.pending_claim_id || claimKill.isPending}
                onClick={() => { hapticImpact('medium'); setConfirmKillOpen(true); }}
              >
                {claimKill.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Skull className="w-4 h-4 mr-2" />}
                Jeg har drept personen
              </Button>
              <Button
                className="w-full h-12"
                variant="outline"
                disabled={confirmDeath.isPending}
                onClick={() => { hapticImpact('light'); setConfirmDeadOpen(true); }}
              >
                {confirmDeath.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Ghost className="w-4 h-4 mr-2" />}
                Jeg har blitt drept
              </Button>
              {state.incoming_claim_killer_name && (
                <p className="text-xs text-center text-muted-foreground">
                  {state.incoming_claim_killer_name} har meldt at du er tatt – bekreft med knappen over.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmKillOpen} onOpenChange={setConfirmKillOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Melde inn drap?</AlertDialogTitle>
            <AlertDialogDescription>
              Du får ikke nytt mål før offeret bekrefter med «Jeg har blitt drept».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleClaim}>Meld drap</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeadOpen} onOpenChange={setConfirmDeadOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekrefte at du er drept?</AlertDialogTitle>
            <AlertDialogDescription>
              Da er du ute av leken, og morderen din arver målet ditt. Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDead}>Ja, jeg er drept</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}