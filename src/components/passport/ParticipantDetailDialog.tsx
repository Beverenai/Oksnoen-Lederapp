import { useState, useEffect, useRef } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Camera, CheckCircle, XCircle, Loader2, Stethoscope, Heart, Trophy } from 'lucide-react';
import { ActivityManager } from './ActivityManager';
import { StyrkeproveBadges } from './StyrkeproveBadges';

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

interface HealthNote {
  id: string;
  content: string;
  created_at: string;
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
  const [participant, setParticipant] = useState<ParticipantWithCabin | null>(null);
  const [activities, setActivities] = useState<ParticipantActivity[]>([]);
  const [healthNotes, setHealthNotes] = useState<HealthNote[]>([]);
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [activityNotes, setActivityNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTogglingArrival, setIsTogglingArrival] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadParticipant = async () => {
    if (!participantId) return;

    setIsLoading(true);
    try {
      // Load participant data
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('*, cabin:cabins(id, name)')
        .eq('id', participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData);
      setActivityNotes(participantData.activity_notes || '');

      // Load activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('participant_activities')
        .select('id, activity, completed_at')
        .eq('participant_id', participantId);

      if (activitiesError) throw activitiesError;
      setActivities(activitiesData || []);

      // Load health notes (nurse notes)
      const { data: healthNotesData, error: healthNotesError } = await supabase
        .from('participant_health_notes')
        .select('id, content, created_at')
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false });

      if (healthNotesError) throw healthNotesError;
      setHealthNotes(healthNotesData || []);

      // Load health info (nurse public info for leaders)
      const { data: healthInfoData, error: healthInfoError } = await supabase
        .from('participant_health_info')
        .select('id, info, participant_id')
        .eq('participant_id', participantId)
        .maybeSingle();

      if (healthInfoError) throw healthInfoError;
      setHealthInfo(healthInfoData || null);
    } catch (error) {
      console.error('Error loading participant:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste deltaker',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && participantId) {
      loadParticipant();
    }
  }, [open, participantId]);

  const handleSaveActivityNotes = async () => {
    if (!participant) return;

    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('participants')
        .update({ activity_notes: activityNotes })
        .eq('id', participant.id);

      if (error) throw error;

      toast({
        title: 'Lagret',
        description: 'Aktivitetsnotater er oppdatert',
      });
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
    if (!file || !participant) return;

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${participant.id}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(filePath, file, { upsert: true });

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

      setParticipant({ ...participant, image_url: imageUrlWithTimestamp });
      toast({
        title: 'Bilde lastet opp',
        description: 'Profilbildet er oppdatert',
      });
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
    if (!participant) return;

    setIsTogglingArrival(true);
    try {
      const newStatus = !participant.has_arrived;
      const { error } = await supabase
        .from('participants')
        .update({ has_arrived: newStatus })
        .eq('id', participant.id);

      if (error) throw error;

      setParticipant({ ...participant, has_arrived: newStatus });
      toast({
        title: newStatus ? 'Ankommet' : 'Ikke ankommet',
        description: `${participant.name} er markert som ${newStatus ? 'ankommet' : 'ikke ankommet'}`,
      });
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

  const age = participant ? calculateAge(participant.birth_date) : null;
  const initials = participant?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : participant ? (
          <>
            {/* Large hero image at top */}
            <div className="relative w-full h-64 bg-muted">
              {participant.image_url ? (
                <img
                  src={participant.image_url}
                  alt={participant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                  <span className="text-6xl font-bold text-muted-foreground/50">{initials}</span>
                </div>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-3 right-3 rounded-full h-10 w-10 shadow-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
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
            <div className="p-6">
              <DialogHeader className="text-center mb-4">
                <DialogTitle className="text-xl">{participant.name}</DialogTitle>

                {/* Age, cabin, room info */}
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
                </div>

                {/* Arrival status badge */}
                <div className="flex justify-center mt-2">
                  <Badge variant={participant.has_arrived ? 'default' : 'secondary'}>
                    {participant.has_arrived ? 'Ankommet' : 'Ikke ankommet'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Nurse health info for leaders (public) */}
                {healthInfo?.info && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Heart className="h-4 w-4 text-blue-600" />
                      <span>Helseinformasjon fra nurse</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                      {healthInfo.info}
                    </div>
                  </div>
                )}

                {/* Nurse notes (read-only) */}
                {healthNotes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Stethoscope className="h-4 w-4 text-pink-600" />
                      <span>Sykepleier-notater</span>
                    </div>
                    <div className="space-y-2">
                      {healthNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 rounded-lg text-sm"
                        >
                          {note.content}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Styrkeprøve badges */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Styrkeprøve</h4>
                  <StyrkeproveBadges completedActivities={activities.map((a) => a.activity)} />
                </div>

                {/* Activities */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Aktiviteter</h4>
                  <ActivityManager
                    participantId={participant.id}
                    completedActivities={activities}
                    onActivityChanged={loadParticipant}
                  />
                </div>

                {/* Activity Notes - for leaders to write achievements */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    <span>Aktivitetsnotater</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Skriv prestasjoner og kommentarer som kan brukes i pass (f.eks. "1. plass i svømming")
                  </p>
                  <Textarea
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    placeholder="F.eks. '1. plass i svømmekonkurranse', 'Traff blink på bueskyting'..."
                    rows={3}
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
                      'Lagre aktivitetsnotater'
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
