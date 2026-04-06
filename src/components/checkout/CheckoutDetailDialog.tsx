import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Home, 
  Calendar, 
  Trophy, 
  Medal, 
  CheckCircle2,
  Loader2,
  Sparkles,
  RefreshCw,
  PenLine,
  RotateCw,
  X
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { 
  hasStoreStyrkprove, 
  hasLilleStyrkprove, 
  getUniqueActivities,
  checkRequirementWithOrLogic,
  getStoreStyrkproveProgress,
  getLilleStyrkproveProgress,
  STORE_STYRKEPROVE_REQUIREMENTS,
  LILLE_STYRKEPROVE_REQUIREMENTS
} from '@/lib/activityUtils';
import { cn } from '@/lib/utils';
import { hapticImpact, hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

interface CheckoutDetailDialogProps {
  participantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface Participant {
  id: string;
  name: string;
  birth_date: string | null;
  cabin_id: string | null;
  room: string | null;
  image_url: string | null;
  pass_suggestion: string | null;
  pass_text: string | null;
  pass_written: boolean | null;
  activity_notes: string | null;
  cabins?: { name: string } | null;
}

interface ParticipantActivity {
  activity: string;
}

export function CheckoutDetailDialog({
  participantId,
  open,
  onOpenChange,
  onComplete,
}: CheckoutDetailDialogProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { leader } = useAuth();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [activities, setActivities] = useState<ParticipantActivity[]>([]);
  const [passText, setPassText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [writeMode, setWriteMode] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);

  useEffect(() => {
    if (participantId && open) {
      loadParticipant();
    }
  }, [participantId, open]);

  // Reset write mode when dialog closes
  useEffect(() => {
    if (!open) {
      setWriteMode(false);
      setIsHorizontal(false);
    }
  }, [open]);

  const loadParticipant = async () => {
    if (!participantId) return;
    
    setIsLoading(true);
    try {
      const [participantRes, activitiesRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, cabins(name)')
          .eq('id', participantId)
          .single(),
        supabase
          .from('participant_activities')
          .select('activity')
          .eq('participant_id', participantId),
      ]);

      if (participantRes.data) {
        setParticipant(participantRes.data);
        // Use pass_text if already written, otherwise use suggestion
        setPassText(participantRes.data.pass_text || participantRes.data.pass_suggestion || '');
      }
      setActivities(activitiesRes.data || []);
    } catch (error) {
      console.error('Error loading participant:', error);
      showError('Kunne ikke laste deltaker');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegeneratePass = async () => {
    if (!participant) return;

    setIsRegenerating(true);
    try {
      const completedActivities = activities.map(a => a.activity);
      const uniqueActivities = getUniqueActivities(completedActivities);
      const age = participant.birth_date 
        ? differenceInYears(new Date(), new Date(participant.birth_date)) 
        : undefined;

      const { data, error } = await supabase.functions.invoke('generate-pass', {
        body: {
          participants: {
            id: participant.id,
            name: participant.name,
            age,
            cabin: participant.cabins?.name || 'Ukjent',
            activities: uniqueActivities,
            activityNotes: participant.activity_notes || '',
            littleStyrkeprove: hasLilleStyrkprove(completedActivities),
            bigStyrkeprove: hasStoreStyrkprove(completedActivities),
          },
          single: true,
        },
      });

      if (error) throw error;

      // Reload participant to get new suggestion
      await loadParticipant();
      showSuccess('Nytt passforslag generert');
    } catch (error) {
      console.error('Error regenerating pass:', error);
      showError('Kunne ikke generere nytt forslag');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleMarkWritten = async () => {
    if (!participant || !leader) return;

    hapticImpact('medium');
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('participants')
        .update({
          pass_written: true,
          pass_text: passText,
          pass_written_at: new Date().toISOString(),
          pass_written_by: leader.id,
        })
        .eq('id', participant.id);

      if (error) throw error;

      hapticSuccess();
      showSuccess('Pass markert som skrevet!');
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error marking pass as written:', error);
      hapticError();
      showError('Kunne ikke lagre');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnmarkWritten = async () => {
    if (!participant) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('participants')
        .update({
          pass_written: false,
          pass_written_at: null,
          pass_written_by: null,
        })
        .eq('id', participant.id);

      if (error) throw error;

      showSuccess('Pass markering fjernet');
      onComplete();
      await loadParticipant();
    } catch (error) {
      console.error('Error unmarking pass:', error);
      showError('Kunne ikke fjerne markering');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  const completedActivities = activities.map(a => a.activity);
  const uniqueActivities = getUniqueActivities(completedActivities);
  const hasStore = hasStoreStyrkprove(completedActivities);
  const hasLille = hasLilleStyrkprove(completedActivities);
  const storeProgress = getStoreStyrkproveProgress(completedActivities);
  const lilleProgress = getLilleStyrkproveProgress(completedActivities);

  const checkRequirement = (req: string) => {
    return checkRequirementWithOrLogic(completedActivities, req);
  };

  // Write mode - fullscreen pass text view with rotation
  if (writeMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-card relative z-10">
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            <span className="font-semibold">{participant?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHorizontal(!isHorizontal)}
              className="gap-2"
            >
              <RotateCw className="w-4 h-4" />
              Roter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWriteMode(false)}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Lukk
            </Button>
          </div>
        </div>
        
        <div 
          className={cn(
            "flex-1 flex items-center justify-center p-6 overflow-auto",
            isHorizontal && "origin-center pointer-events-none"
          )}
          style={isHorizontal ? {
            transform: 'rotate(90deg)',
            width: '100vh',
            height: '100vw',
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-50vw',
            marginLeft: '-50vh',
          } : undefined}
        >
          <div className={cn(
            "w-full max-w-2xl bg-card border rounded-lg p-6 shadow-lg",
            isHorizontal && "max-w-none w-[80vh] pointer-events-auto"
          )}>
            <p className="text-xl md:text-2xl leading-relaxed whitespace-pre-wrap">
              {passText || 'Ingen pass-tekst ennå...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Skriv pass
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {isLoading ? (
          <div className="space-y-4 p-4 md:p-0">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : participant ? (
          <div className="space-y-4 md:space-y-6 p-4 md:p-0">
            {/* Participant Info */}
            <div className="flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-muted/50 rounded-lg">
              <Avatar className="w-12 h-12 md:w-16 md:h-16">
                <AvatarImage src={participant.image_url || undefined} />
                <AvatarFallback className="bg-primary/10">
                  <User className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-1.5 md:space-y-2">
                <h3 className="text-lg md:text-xl font-semibold truncate">{participant.name}</h3>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {participant.birth_date && (
                    <Badge variant="outline" className="gap-1 text-xs md:text-sm">
                      <Calendar className="w-3 h-3" />
                      {differenceInYears(new Date(), new Date(participant.birth_date))} år
                    </Badge>
                  )}
                  {participant.cabins && (
                    <Badge variant="secondary" className="gap-1 text-xs md:text-sm">
                      <Home className="w-3 h-3" />
                      {participant.cabins.name}
                    </Badge>
                  )}
                  {participant.room && (
                    <Badge variant="outline" className="text-xs md:text-sm">{participant.room}</Badge>
                  )}
                </div>
              </div>
              {participant.pass_written && (
                <Badge className="bg-success hover:bg-success gap-1 shrink-0 text-xs md:text-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Skrevet
                </Badge>
              )}
            </div>

            {/* Styrkeprøve Status */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="font-semibold text-sm md:text-base">Styrkeprøve</h4>
              
              {hasStore && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 mb-2 text-xs md:text-sm">
                  <Trophy className="w-3 h-3 md:w-4 md:h-4" />
                  Store Styrkeprøven ✅
                </Badge>
              )}
              {hasLille && !hasStore && (
                <Badge className="bg-slate-400 hover:bg-slate-500 text-white gap-1 mb-2 text-xs md:text-sm">
                  <Medal className="w-3 h-3 md:w-4 md:h-4" />
                  Lille Styrkeprøven ✅
                </Badge>
              )}
              {!hasStore && !hasLille && (
                <p className="text-xs md:text-sm text-muted-foreground mb-2">Ingen styrkeprøve fullført</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="p-2.5 md:p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Store Styrkeprøven</p>
                    <Badge variant="outline" className="text-xs">
                      {storeProgress.completed}/{storeProgress.total}
                    </Badge>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    {STORE_STYRKEPROVE_REQUIREMENTS.map(req => (
                      <div key={req} className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                        {checkRequirement(req) ? (
                          <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-success shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={cn("truncate", !checkRequirement(req) && 'text-muted-foreground')}>
                          {req}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-2.5 md:p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Lille Styrkeprøven</p>
                    <Badge variant="outline" className="text-xs">
                      {lilleProgress.completed}/{lilleProgress.total}
                    </Badge>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    {LILLE_STYRKEPROVE_REQUIREMENTS.map(req => (
                      <div key={req} className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                        {checkRequirement(req) ? (
                          <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-success shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={cn("truncate", !checkRequirement(req) && 'text-muted-foreground')}>
                          {req}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="font-semibold text-sm md:text-base">
                Aktiviteter ({uniqueActivities.length} unike)
              </h4>
              {uniqueActivities.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {uniqueActivities.map((activity, index) => (
                    <Badge key={index} variant="secondary" className="text-xs md:text-sm">
                      {activity}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs md:text-sm text-muted-foreground">Ingen aktiviteter registrert</p>
              )}
            </div>

            {/* Activity Notes from leaders */}
            {participant.activity_notes && (
              <div className="space-y-2 md:space-y-3">
                <h4 className="font-semibold text-sm md:text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  Aktivitetsnotater fra ledere
                </h4>
                <div className="p-2.5 md:p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg text-xs md:text-sm">
                  {participant.activity_notes}
                </div>
              </div>
            )}

            {/* Pass Text */}
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-sm md:text-base">Pass-tekst</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWriteMode(true)}
                    className="gap-1 text-xs md:text-sm"
                  >
                    <PenLine className="w-3 h-3" />
                    <span className="hidden sm:inline">Skriv i pass</span>
                    <span className="sm:hidden">Skriv</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegeneratePass}
                    disabled={isRegenerating}
                    className="gap-1 text-xs md:text-sm"
                  >
                    {isRegenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">Nytt forslag</span>
                    <span className="sm:hidden">Ny</span>
                  </Button>
                </div>
              </div>
              <Textarea
                value={passText}
                onChange={(e) => setPassText(e.target.value)}
                placeholder="Skriv passet her..."
                rows={3}
                className="resize-none text-sm md:text-base"
              />
              <p className="text-xs text-muted-foreground">
                Rediger teksten og trykk "Skrevet ferdig" når du har skrevet passet fysisk.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 md:gap-3 pt-3 md:pt-4 border-t">
              {participant.pass_written ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleUnmarkWritten}
                    disabled={isSaving}
                    className="flex-1 text-xs md:text-sm"
                  >
                    Fjern markering
                  </Button>
                  <Button
                    onClick={handleMarkWritten}
                    disabled={isSaving}
                    className="flex-1 gap-2 text-xs md:text-sm"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Lagre endringer
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleMarkWritten}
                  disabled={isSaving}
                  className="flex-1 gap-2 bg-success hover:bg-success/90 text-xs md:text-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Skrevet ferdig pass
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Kunne ikke laste deltaker
          </p>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
