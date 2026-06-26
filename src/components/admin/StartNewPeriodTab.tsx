import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { AlertTriangle, Archive, Loader2, RotateCcw } from 'lucide-react';

interface NursePeriod {
  id: string;
  name: string;
  is_active: boolean | null;
}

export function StartNewPeriodTab() {
  const { showSuccess, showError } = useStatusPopup();
  const [periods, setPeriods] = useState<NursePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [confirmText, setConfirmText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [participantCount, setParticipantCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('nurse_periods')
        .select('id, name, is_active')
        .order('created_at', { ascending: false });
      const list = data ?? [];
      setPeriods(list);
      const active = list.find((p) => p.is_active);
      if (active) setSelectedPeriod(active.id);

      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true });
      setParticipantCount(count ?? 0);
    })();
  }, []);

  const runStartNewPeriod = async () => {
    if (!selectedPeriod) {
      showError('Velg en nurse-periode å arkivere til');
      return;
    }
    setIsRunning(true);
    const { data, error } = await supabase.rpc('start_new_period', {
      _nurse_period_id: selectedPeriod,
    });
    setIsRunning(false);
    if (error) {
      showError(error.message);
      return;
    }
    const result = data as {
      archived_participants: number;
      deleted_participants: number;
      deleted_overnatting: number;
      gjenglemt_attached_to_active_period: number;
    };
    showSuccess(
      `Arkivert ${result.archived_participants} deltagere med nurse-logger, slettet ${result.deleted_participants} deltagere og ${result.deleted_overnatting} overnatting-svar. ${result.gjenglemt_attached_to_active_period} gjenglemt-gjenstander knyttet til aktiv periode.`
    );
    setConfirmText('');
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true });
    setParticipantCount(count ?? 0);
  };

  return (
    <div className="space-y-4">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Start ny periode
          </CardTitle>
          <CardDescription>
            Arkiverer alle nurse-logger til valgt periode, knytter gjenglemt-gjenstander uten periode til aktiv gjenglemt-periode, og <strong>sletter alle deltagere og overnatting-svar</strong>. Kan ikke angres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p>
              <strong>Deltagere i databasen nå:</strong>{' '}
              {participantCount === null ? '...' : participantCount}
            </p>
            <p className="text-muted-foreground text-xs">
              Nurse-logger (notater, hendelser, viktig info) for hver deltager blir lagret som et arkiv knyttet til valgt periode, før deltagerene slettes.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Arkiver nurse-logger til periode</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Velg nurse-periode" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.is_active ? '(aktiv)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {periods.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Ingen nurse-perioder funnet. Opprett en under «Nurse-perioder» først.
              </p>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!selectedPeriod || isRunning}
                className="w-full"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Start ny periode
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Er du helt sikker?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>Dette vil:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>
                        Arkivere nurse-logger for{' '}
                        <strong>
                          {periods.find((p) => p.id === selectedPeriod)?.name}
                        </strong>
                      </li>
                      <li>Knytte alle gjenglemt-gjenstander uten periode til aktiv gjenglemt-periode</li>
                      <li>
                        <strong>Slette alle {participantCount ?? 0} deltagere</strong> (med alle aktiviteter, pass, helse-notater)
                      </li>
                      <li>Slette alle overnatting-svar</li>
                    </ul>
                    <p className="pt-2">
                      Skriv <code className="bg-muted px-1 rounded">SLETT</code> for å bekrefte:
                    </p>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="SLETT"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText('')}>
                  Avbryt
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== 'SLETT' || isRunning}
                  onClick={runStartNewPeriod}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Ja, arkiver og slett
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}