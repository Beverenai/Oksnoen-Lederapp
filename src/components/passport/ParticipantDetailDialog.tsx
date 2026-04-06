import { useState, useRef, useEffect } from 'react';
import { formatFullRoom } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Camera, CheckCircle, XCircle, Loader2, Heart, Trophy } from 'lucide-react';
import { ActivityManager } from './ActivityManager';
import { StyrkeproveBadges } from './StyrkeproveBadges';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/imageUtils';
import { CachedImage } from '@/components/ui/cached-image';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

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

// Fetch participant detail directly from Supabase
async function fetchParticipantDetail(participantId: string): Promise<{
  participant: ParticipantWithCabin;
  healthInfo: HealthInfo | null;
  activities: ParticipantActivity[];
}> {
  const [participantRes, activitiesRes, healthRes] = await Promise.all([
    supabase.from('participants').select('*, cabins:cabin_id(id, name)').eq('id', participantId).single(),
    supabase.from('participant_activities').select('*').eq('participant_id', participantId),
    supabase.from('participant_health_info').select('*').eq('participant_id', participantId).maybeSingle()
  ]);

  if (participantRes.error) throw participantRes.error;

  return {
    participant: {
      ...participantRes.data,
      cabin: participantRes.data.cabins
    } as ParticipantWithCabin,
    healthInfo: healthRes.data as HealthInfo | null,
    activities: (activitiesRes.data || []) as ParticipantActivity[]
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
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const queryClient = useQueryClient();
  const [activityNotes, setActivityNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTogglingArrival, setIsTogglingArrival] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch participant detail with caching
  const { data, isLoading, refetch: refetchParticipant } = useQuery({
    queryKey: ['participant-detail', participantId],
    queryFn: () => fetchParticipantDetail(participantId!),
    enabled: open && !!participantId,
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
    if (!participant) return;

    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('participants')
        .update({ activity_notes: activityNotes })
        .eq('id', participant.id);

      if (error) throw error;

      showSuccess('Lagret', 'Aktivitetsnotater er oppdatert');
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error saving activity notes:', error);
      showError('Feil', 'Kunne ikke lagre aktivitetsnotater');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !participant) return;

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

      const { error: updateError } = await supabase
        .from('participants')
        .update({ image_url: imageUrlWithTimestamp })
        .eq('id', participant.id);

      if (updateError) throw updateError;

      showSuccess('Bilde lastet opp', 'Profilbildet er oppdatert');
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error uploading image:', error);
      showError('Feil', 'Kunne ikke laste opp bilde');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleArrival = async () => {
    if (!participant) return;

    setIsTogglingArrival(true);
    try {
      const newStatus = !participant.has_arrived;
      
      const { error } = await supabase
        .from('participants')
        .update({ has_arrived: newStatus })
        .eq('id', participant.id);

      if (error) throw error;

      showSuccess(newStatus ? 'Ankommet' : 'Ikke ankommet', `${participant.name} er markert som ${newStatus ? 'ankommet' : 'ikke ankommet'}`);
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error toggling arrival:', error);
      showError('Feil', 'Kunne ikke oppdatere ankomststatus');
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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : participant ? (
          <>
            {/* Large hero image at top */}
            <div className="relative w-full h-32 sm:h-48 bg-muted flex-shrink-0">
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
              <ResponsiveDialogHeader className="text-center mb-3">
                <ResponsiveDialogTitle className="text-lg sm:text-xl">{participant.name}</ResponsiveDialogTitle>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground flex-wrap">
                  {age !== null && <span>{age} år</span>}
                  {participant.room && (
                    <>
                      <span>•</span>
                      <span>{formatFullRoom(participant.cabin?.name ?? null, participant.room) || participant.room}</span>
                    </>
                  )}
                  {!participant.room && participant.cabin && (
                    <>
                      <span>•</span>
                      <span>{participant.cabin.name}</span>
                    </>
                  )}
                  <span>•</span>
                  <Badge variant={participant.has_arrived ? 'default' : 'secondary'} className="text-xs">
                    {participant.has_arrived ? 'Ankommet' : 'Ikke ankommet'}
                  </Badge>
                </div>
              </ResponsiveDialogHeader>

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
            {/* Safe area spacer for iOS */}
            <div className="pb-safe" />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Deltaker ikke funnet
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
