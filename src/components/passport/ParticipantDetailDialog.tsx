import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Camera, CheckCircle, XCircle, Loader2, Heart, Trophy } from 'lucide-react';
import { ActivityManager } from './ActivityManager';
import { StyrkeproveBadges } from './StyrkeproveBadges';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/imageUtils';
import { CachedImage } from '@/components/ui/cached-image';

interface ParticipantWithCabin {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  cabin_id: string | null;
  room: string | null;
  has_arrived: boolean | null;
  notes: string | null;
  activity_notes: string | null;
  image_url: string | null;
  times_attended: number | null;
  cabin?: { id: string; name: string } | null;
}

interface ParticipantActivity {
  id: string;
  activity: string;
  completed_at: string | null;
}

interface HealthInfo {
  id: string;
  info: string;
  participant_id: string;
}

interface ParticipantDetailDialogProps {
  participantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParticipantUpdated?: () => void;
}

// Fetch participant detail via edge function
async function fetchParticipantDetailSecure(leaderId: string, participantId: string): Promise<{
  participant: ParticipantWithCabin;
  healthInfo: HealthInfo | null;
  activities: ParticipantActivity[];
}> {
  const { data, error } = await supabase.functions.invoke('get-participants', {
    body: { 
      leader_id: leaderId, 
      participant_id: participantId,
      include_health_info: true,
      include_activities: true
    }
  });
  if (error) throw error;
  return {
    participant: data.participant,
    healthInfo: data.healthInfo,
    activities: data.activities || []
  };
}

const calculateAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const ParticipantDetailDialog = ({
  participantId,
  open,
  onOpenChange,
  onParticipantUpdated,
}: ParticipantDetailDialogProps) => {
  const { leader, isAdmin, isNurse } = useAuth();
  const queryClient = useQueryClient();
  const [activityNotes, setActivityNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTogglingArrival, setIsTogglingArrival] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch participant detail with caching via edge function
  const { data, isLoading, refetch: refetchParticipant } = useQuery({
    queryKey: ['participant-detail-secure', leader?.id, participantId],
    queryFn: () => fetchParticipantDetailSecure(leader!.id, participantId!),
    enabled: open && !!participantId && !!leader?.id,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  const participant = data?.participant;
  const healthInfo = data?.healthInfo;
  const activities = data?.activities || [];

  // Update activity notes when participant changes
  useEffect(() => {
    if (participant?.activity_notes !== undefined) {
      setActivityNotes(participant.activity_notes || '');
    }
  }, [participant?.activity_notes]);

  const handleSaveActivityNotes = async () => {
    if (!participant || !leader) return;

    setIsSavingNotes(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-participants', {
        body: {
          leader_id: leader.id,
          participant_id: participant.id,
          action: 'update',
          update_data: { activity_notes: activityNotes }
        }
      });

      if (error) throw error;

      toast({
        title: 'Lagret',
        description: 'Aktivitetsnotater er oppdatert',
      });
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error saving activity notes:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke lagre aktivitetsnotater',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !participant || !leader) return;

    setIsUploadingImage(true);
    try {
      const compressedFile = await compressImage(file);
      const fileName = `${participant.id}.jpg`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(filePath, compressedFile, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('participant-images')
        .getPublicUrl(filePath);

      const imageUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Update via edge function
      const { error: updateError } = await supabase.functions.invoke('get-participants', {
        body: {
          leader_id: leader.id,
          participant_id: participant.id,
          action: 'update',
          update_data: { image_url: imageUrlWithTimestamp }
        }
      });

      if (updateError) throw updateError;

      toast({
        title: 'Bilde lastet opp',
        description: 'Profilbildet er oppdatert',
      });
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste opp bilde',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleArrival = async () => {
    if (!participant || !leader) return;

    setIsTogglingArrival(true);
    try {
      const newStatus = !participant.has_arrived;
      
      const { error } = await supabase.functions.invoke('get-participants', {
        body: {
          leader_id: leader.id,
          participant_id: participant.id,
          action: 'update',
          update_data: { has_arrived: newStatus }
        }
      });

      if (error) throw error;

      toast({
        title: newStatus ? 'Ankommet' : 'Ikke ankommet',
        description: `${participant.name} er markert som ${newStatus ? 'ankommet' : 'ikke ankommet'}`,
      });
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error toggling arrival:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere ankomststatus',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingArrival(false);
    }
  };

  const handleActivityChanged = () => {
    refetchParticipant();
  };

  const age = participant ? calculateAge(participant.birth_date) : null;
  const initials = participant?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto app-scroll p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : participant ? (
          <>
            {/* Large hero image at top */}
            <div className="relative w-full h-32 sm:h-48 bg-muted">
              {participant.image_url ? (
                <CachedImage
                  src={participant.image_url}
                  alt={participant.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-4xl sm:text-6xl font-bold text-muted-foreground/50">{initials}</span>
                    </div>
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                  <span className="text-4xl sm:text-6xl font-bold text-muted-foreground/50">{initials}</span>
                </div>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-2 right-2 rounded-full h-8 w-8 sm:h-10 sm:w-10 shadow-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Content below image */}
            <div className="p-4 sm:p-6">
              <DialogHeader className="text-center mb-3">
                <DialogTitle className="text-lg sm:text-xl">{participant.name}</DialogTitle>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground flex-wrap">
                  {age !== null && <span>{age} år</span>}
                  {age !== null && participant.cabin && <span>•</span>}
                  {participant.cabin && <span>{participant.cabin.name}</span>}
                  {participant.room && (
                    <>
                      <span>•</span>
                      <span>Rom {participant.room}</span>
                    </>
                  )}
                  <span>•</span>
                  <Badge variant={participant.has_arrived ? 'default' : 'secondary'} className="text-xs">
                    {participant.has_arrived ? 'Ankommet' : 'Ikke ankommet'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Info fra Nurse */}
                {healthInfo?.info && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Heart className="h-4 w-4 text-blue-600" />
                      <span>Info fra Nurse</span>
                    </div>
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                      {healthInfo.info}
                    </div>
                  </div>
                )}

                {/* Styrkeprøve badges */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-medium">Styrkeprøve</h4>
                  <StyrkeproveBadges completedActivities={activities.map((a) => a.activity)} />
                </div>

                {/* Activities */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-medium">Aktiviteter</h4>
                  <ActivityManager
                    participantId={participant.id}
                    completedActivities={activities}
                    onActivityChanged={handleActivityChanged}
                  />
                </div>

                {/* Activity Notes */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    <span>Aktivitetsnotater</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Skriv prestasjoner som kan brukes i pass
                  </p>
                  <Textarea
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    placeholder="F.eks. '1. plass i svømming'..."
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveActivityNotes}
                    disabled={isSavingNotes}
                  >
                    {isSavingNotes ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Lagrer...
                      </>
                    ) : (
                      'Lagre notater'
                    )}
                  </Button>
                </div>

                {/* Arrival toggle */}
                <Button
                  variant={participant.has_arrived ? 'outline' : 'default'}
                  className="w-full"
                  onClick={toggleArrival}
                  disabled={isTogglingArrival}
                >
                  {isTogglingArrival ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : participant.has_arrived ? (
                    <XCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {participant.has_arrived ? 'Marker som ikke ankommet' : 'Marker som ankommet'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Deltaker ikke funnet
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
