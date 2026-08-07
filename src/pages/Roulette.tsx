import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Dices, Check, SkipForward, Loader2, Sparkles, ListChecks } from 'lucide-react';
import {
  useIsU18,
  useCurrentAssignment,
  useDrawRouletteTask,
  useCompleteAssignment,
  useSkipAssignment,
} from '@/hooks/useRoulette';
import { useStatusPopup } from '@/hooks/useStatusPopup';

export default function Roulette() {
  const navigate = useNavigate();
  const { effectiveLeader } = useAuth();
  const { showSuccess, showError, showInfo } = useStatusPopup();

  const { data: rouletteEnabled, isLoading: cfgLoading } = useQuery({
    queryKey: ['app_config', 'roulette_enabled'],
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'roulette_enabled').maybeSingle();
      return data?.value === 'true';
    },
  });
  const inRoulette = !!(effectiveLeader as any)?.in_roulette;

  const { data: isU18 = false, isLoading: u18Loading } = useIsU18(effectiveLeader?.id);
  const { data: assignment, isLoading: aLoading } = useCurrentAssignment(effectiveLeader?.id);
  const draw = useDrawRouletteTask();
  const complete = useCompleteAssignment();
  const skip = useSkipAssignment();

  const handleDraw = async () => {
    try {
      await draw.mutateAsync({ isU18 });
      showSuccess('Ny oppgave hentet!');
    } catch (e: any) {
      showError(e?.message ?? 'Kunne ikke hente oppgave');
    }
  };

  const handleComplete = async () => {
    if (!assignment) return;
    try {
      await complete.mutateAsync(assignment.id);
      showSuccess('Bra jobba! 🎉');
      // Auto-draw next
      setTimeout(() => handleDraw(), 300);
    } catch {
      showError('Kunne ikke fullføre');
    }
  };

  const handleSkip = async () => {
    if (!assignment) return;
    if (!confirm('Hoppe over denne oppgaven og få en ny?')) return;
    try {
      await skip.mutateAsync(assignment.id);
      showInfo('Oppgave hoppet over');
      setTimeout(() => handleDraw(), 200);
    } catch {
      showError('Kunne ikke hoppe over');
    }
  };

  const loading = u18Loading || aLoading || cfgLoading;

  const blocked = !cfgLoading && (!rouletteEnabled || !inRoulette);

  return (
    <div className="flex flex-col animate-fade-in min-h-[calc(100dvh-140px)]">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
            <Dices className="h-5 w-5 text-primary" /> Oppgave-roulette
          </h1>
          <p className="text-sm text-muted-foreground">
            {isU18 ? 'U18-oppgaver' : 'Senior-oppgaver'} for {effectiveLeader?.name?.split(' ')[0]}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : blocked ? (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center text-center gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Dices className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-heading font-semibold">Ikke tilgjengelig</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {rouletteEnabled
                ? 'Du er ikke lagt til i Oppgave-rouletten av admin.'
                : 'Oppgave-roulette er ikke aktivert akkurat nå.'}
            </p>
          </CardContent>
        </Card>
      ) : assignment ? (
        <Card className="overflow-hidden border-primary/30 shadow-sm">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 border-b border-primary/10">
            <Badge variant="secondary" className="mb-2">
              <Sparkles className="h-3 w-3 mr-1" /> Din oppgave
            </Badge>
            <h2 className="text-2xl font-heading font-bold leading-tight">
              {assignment.task?.title}
            </h2>
            {assignment.task?.description && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {assignment.task.description}
              </p>
            )}
          </div>
          <CardContent className="p-4 space-y-2">
            <Button
              onClick={handleComplete}
              disabled={complete.isPending}
              className="w-full h-14 text-base"
              size="lg"
            >
              {complete.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <><Check className="h-5 w-5 mr-2" /> Oppgaven er gjort</>
              )}
            </Button>
            <Button
              onClick={handleSkip}
              disabled={skip.isPending}
              variant="ghost"
              className="w-full"
            >
              <SkipForward className="h-4 w-4 mr-2" /> Hopp over
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center text-center gap-4">
            <div className="p-4 rounded-full bg-primary/10">
              <ListChecks className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-semibold">Ingen oppgave akkurat nå</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Trekk en tilfeldig oppgave fra rouletten.
              </p>
            </div>
            <Button onClick={handleDraw} disabled={draw.isPending} size="lg" className="h-12">
              {draw.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <><Dices className="h-5 w-5 mr-2" /> Hent oppgave</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}