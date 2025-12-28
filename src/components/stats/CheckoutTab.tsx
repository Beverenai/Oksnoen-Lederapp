import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';
import { hasStoreStyrkprove, hasLilleStyrkprove, getUniqueActivities } from '@/lib/activityUtils';

interface Participant {
  id: string;
  name: string;
  birth_date: string | null;
  cabin_id: string | null;
  pass_suggestion: string | null;
  pass_written: boolean | null;
}

interface Cabin {
  id: string;
  name: string;
}

interface ParticipantActivity {
  participant_id: string;
  activity: string;
}

export function CheckoutTab() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [activities, setActivities] = useState<ParticipantActivity[]>([]);
  const [passWrittenCount, setPassWrittenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configRes, participantsRes, cabinsRes, activitiesRes] = await Promise.all([
        supabase.from('app_config').select('*').eq('key', 'checkout_enabled').single(),
        supabase.from('participants').select('id, name, birth_date, cabin_id, pass_suggestion, pass_written'),
        supabase.from('cabins').select('id, name'),
        supabase.from('participant_activities').select('participant_id, activity'),
      ]);

      setCheckoutEnabled(configRes.data?.value === 'true');
      setParticipants(participantsRes.data || []);
      setCabins(cabinsRes.data || []);
      setActivities(activitiesRes.data || []);
      setTotalParticipants(participantsRes.data?.length || 0);
      setPassWrittenCount(participantsRes.data?.filter(p => p.pass_written).length || 0);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCabinName = (cabinId: string | null): string => {
    if (!cabinId) return 'Ukjent';
    return cabins.find(c => c.id === cabinId)?.name || 'Ukjent';
  };

  const getParticipantActivities = (participantId: string): string[] => {
    return activities
      .filter(a => a.participant_id === participantId)
      .map(a => a.activity);
  };

  const handleStartCheckout = async () => {
    setIsGenerating(true);
    setProgress(0);
    setProcessedCount(0);

    try {
      // Prepare participant data for AI
      const participantData = participants.map(p => {
        const completedActivities = getParticipantActivities(p.id);
        const uniqueActivities = getUniqueActivities(completedActivities);
        const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : undefined;

        return {
          id: p.id,
          name: p.name,
          age,
          cabin: getCabinName(p.cabin_id),
          activities: uniqueActivities,
          littleStyrkeprove: hasLilleStyrkprove(completedActivities),
          bigStyrkeprove: hasStoreStyrkprove(completedActivities),
        };
      });

      // Process in batches of 5 to show progress
      const batchSize = 5;
      for (let i = 0; i < participantData.length; i += batchSize) {
        const batch = participantData.slice(i, i + batchSize);
        
        const { error } = await supabase.functions.invoke('generate-pass', {
          body: { participants: batch, single: false },
        });

        if (error) {
          console.error('Error generating passes:', error);
          toast.error('Feil ved generering av pass');
          throw error;
        }

        const processed = Math.min(i + batchSize, participantData.length);
        setProcessedCount(processed);
        setProgress((processed / participantData.length) * 100);
      }

      // Enable checkout
      await supabase
        .from('app_config')
        .update({ value: 'true' })
        .eq('key', 'checkout_enabled');

      setCheckoutEnabled(true);
      toast.success('Utsjekk aktivert! Ledere kan nå skrive pass.');
      await loadData();
    } catch (error) {
      console.error('Error starting checkout:', error);
      toast.error('Kunne ikke starte utsjekk');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDisableCheckout = async () => {
    try {
      await supabase
        .from('app_config')
        .update({ value: 'false' })
        .eq('key', 'checkout_enabled');
      
      setCheckoutEnabled(false);
      toast.success('Utsjekk deaktivert');
    } catch (error) {
      console.error('Error disabling checkout:', error);
      toast.error('Kunne ikke deaktivere utsjekk');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Utsjekk - Pass-generering
          </CardTitle>
          <CardDescription>
            Start utsjekk for å generere AI-baserte passforslag for alle deltakere.
            Når aktivert, vil ledere se en Utsjekk-knapp i Passkontroll.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <Badge 
              variant={checkoutEnabled ? 'default' : 'secondary'}
              className={checkoutEnabled ? 'bg-success hover:bg-success' : ''}
            >
              {checkoutEnabled ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Aktiv
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Ikke startet
                </>
              )}
            </Badge>
            {checkoutEnabled && (
              <span className="text-sm text-muted-foreground">
                {passWrittenCount} av {totalParticipants} pass skrevet
              </span>
            )}
          </div>

          {/* Progress during generation */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Genererer passforslag...</span>
                <span>{processedCount} / {totalParticipants}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!checkoutEnabled ? (
              <Button 
                onClick={handleStartCheckout} 
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Genererer...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Start Utsjekk
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleStartCheckout} 
                  disabled={isGenerating}
                  variant="outline"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Genererer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generer på nytt
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleDisableCheckout} 
                  variant="destructive"
                  disabled={isGenerating}
                >
                  Deaktiver Utsjekk
                </Button>
              </>
            )}
          </div>

          {/* Stats when enabled */}
          {checkoutEnabled && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Fremgang</h4>
              <div className="space-y-2">
                <Progress value={(passWrittenCount / totalParticipants) * 100} className="h-3" />
                <p className="text-sm text-muted-foreground">
                  {passWrittenCount} av {totalParticipants} deltakere har fått pass skrevet
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hvordan fungerer utsjekk?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. <strong>Start Utsjekk</strong> - AI genererer passforslag for alle deltakere basert på aktiviteter og styrkeprøve.</p>
          <p>2. <strong>Ledere skriver pass</strong> - I Passkontroll får ledere tilgang til Utsjekk-knappen og kan skrive pass.</p>
          <p>3. <strong>AI-forslag</strong> - Hvert pass har et AI-generert forslag som kan redigeres eller brukes som det er.</p>
          <p>4. <strong>Markér ferdig</strong> - Når passet er skrevet fysisk, markeres deltakeren som ferdig.</p>
        </CardContent>
      </Card>
    </div>
  );
}
