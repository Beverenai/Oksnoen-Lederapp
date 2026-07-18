import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { formatFullRoom } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Camera, CheckCircle, XCircle, Loader2, Heart, Trophy, Plus, Minus, Sparkles, MessageSquareWarning, BookUser } from 'lucide-react';
import { ActivityManager } from './ActivityManager';
import { StyrkeproveBadges } from './StyrkeproveBadges';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/imageUtils';
import { CachedImage } from '@/components/ui/cached-image';
import { TeamBadge } from '@/components/participants/TeamBadge';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import { isNativeCameraAvailable, takePhoto } from '@/lib/capacitorCamera';
import { IncidentSheet } from '@/components/incidents/IncidentSheet';
import { BookingDetailSheet } from '@/components/admin/bookings/BookingDetailSheet';
import type { Tables } from '@/integrations/supabase/types';

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
  pass_written: boolean | null;
  pass_written_at: string | null;
  pass_written_by: string | null;
  pass_text: string | null;
  pass_suggestion: string | null;
  gift_card_number: string | null;
  team_id?: string | null;
  insj_points?: number | null;
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
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTogglingArrival, setIsTogglingArrival] = useState(false);
  const [isTogglingPass, setIsTogglingPass] = useState(false);
  const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingData, setBookingData] = useState<Tables<'participant_bookings'> | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSnapshotRef = useRef<string>('');
  const isEditingNotesRef = useRef(false);

  // Fetch participant detail with caching
  const { data, isLoading, refetch: refetchParticipant } = useQuery({
    queryKey: ['participant-detail-v2', participantId],
    queryFn: () => fetchParticipantDetail(participantId!),
    enabled: open && !!participantId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: checkoutEnabled = false } = useQuery({
    queryKey: ['checkout-enabled'],
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'checkout_enabled').maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 60_000,
  });

  const { data: secretWord } = useQuery({
    queryKey: ['secret-word', participantId],
    enabled: open && !!participantId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('secret_word_assignments')
        .select('word')
        .eq('participant_id', participantId!)
        .maybeSingle();
      return (data?.word as string | undefined) ?? null;
    },
    staleTime: 60_000,
  });

  const participant = data?.participant;
  const healthInfo = data?.healthInfo;
  const activities = data?.activities || [];

  // Update activity notes when participant changes
  useEffect(() => {
    if (participant?.activity_notes !== undefined) {
      const v = participant.activity_notes || '';
      if (!isEditingNotesRef.current && notesStatus !== 'saving') {
        setActivityNotes(v);
        savedSnapshotRef.current = v;
      }
    }
  }, [participant?.activity_notes, notesStatus]);

  useEffect(() => {
    if (!participantId || !open) return;

    isEditingNotesRef.current = false;
    setNotesStatus('idle');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
  }, [participantId, open]);

  const saveActivityNotes = useCallback(async (participantToSave: ParticipantWithCabin, value: string) => {
    const { error } = await supabase
      .from('participants')
      .update({ activity_notes: value })
      .eq('id', participantToSave.id);

    if (error) {
      console.error('Error saving activity notes:', error);
      setNotesStatus('idle');
      showError('Feil', 'Kunne ikke lagre aktivitetsnotater');
      return;
    }

    savedSnapshotRef.current = value;
    isEditingNotesRef.current = false;
    setNotesStatus('saved');
    queryClient.setQueryData(['participant-detail-v2', participantToSave.id], (old: any) => old ? {
      ...old,
      participant: {
        ...old.participant,
        activity_notes: value,
      },
    } : old);
    onParticipantUpdated?.();
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    savedIndicatorTimerRef.current = setTimeout(() => {
      setNotesStatus((s) => (s === 'saved' ? 'idle' : s));
    }, 1500);
  }, [onParticipantUpdated, queryClient, showError]);

  // Save activity notes when dialog closes (if changed)
  useEffect(() => {
    if (open) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    if (participant && activityNotes !== savedSnapshotRef.current) {
      void saveActivityNotes(participant, activityNotes);
    }
    setNotesStatus('idle');
    isEditingNotesRef.current = false;
  }, [open, participant, activityNotes, saveActivityNotes]);

  const uploadParticipantImage = async (file: File) => {
    if (!file || !participant) return;

    setIsUploadingImage(true);
    try {
      const compressedFile = await compressImage(file, {
        maxSizeMB: 3,
        maxWidthOrHeight: 2400,
        initialQuality: 0.95,
      });
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadParticipantImage(file);
  };

  const handleImageButtonClick = async () => {
    if (isNativeCameraAvailable()) {
      const file = await takePhoto();
      if (file) {
        await uploadParticipantImage(file);
      }
      return;
    }

    fileInputRef.current?.click();
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

  const togglePassWritten = async () => {
    if (!participant || !leader) return;
    setIsTogglingPass(true);
    try {
      const newStatus = !participant.pass_written;
      const { error } = await supabase
        .from('participants')
        .update(
          newStatus
            ? {
                pass_written: true,
                pass_written_at: new Date().toISOString(),
                pass_written_by: leader.id,
              }
            : {
                pass_written: false,
                pass_written_at: null,
                pass_written_by: null,
              }
        )
        .eq('id', participant.id);
      if (error) throw error;
      hapticSuccess();
      showSuccess(newStatus ? 'Pass markert som skrevet' : 'Markering fjernet');
      refetchParticipant();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error toggling pass_written:', error);
      hapticError();
      showError('Feil', 'Kunne ikke oppdatere passtatus');
    } finally {
      setIsTogglingPass(false);
    }
  };

  const adjustInsjPoints = async (delta: number) => {
    if (!participant) return;
    setIsUpdatingPoints(true);
    const current = (participant.insj_points ?? 0);
    const next = Math.max(0, current + delta);
    // Optimistic update
    queryClient.setQueryData(['participant-detail-v2', participant.id], (old: any) => old ? {
      ...old,
      participant: { ...old.participant, insj_points: next },
    } : old);
    try {
      const { error } = await supabase
        .from('participants')
        .update({ insj_points: next })
        .eq('id', participant.id);
      if (error) throw error;
      hapticSuccess();
      onParticipantUpdated?.();
    } catch (error) {
      console.error('Error updating insj_points:', error);
      hapticError();
      showError('Feil', 'Kunne ikke oppdatere insjpoeng');
      refetchParticipant();
    } finally {
      setIsUpdatingPoints(false);
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
    <>
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : participant ? (
          <>
            {/* Round avatar at top — tap to view full image */}
            <div className="flex justify-center pt-6 pb-2 flex-shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => participant.image_url && setLightboxOpen(true)}
                  disabled={!participant.image_url}
                  className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden bg-muted ring-2 ring-border shadow-md disabled:cursor-default focus:outline-none focus:ring-4 focus:ring-primary/40"
                  aria-label={participant.image_url ? 'Vis bilde' : 'Ingen bilde'}
                >
                  {participant.image_url ? (
                    <CachedImage
                      src={participant.image_url}
                      alt={participant.name}
                      className="w-full h-full object-cover"
                      loading="eager"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                          <span className="text-3xl font-bold text-muted-foreground/50">{initials}</span>
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-3xl font-bold text-muted-foreground/50">{initials}</span>
                    </div>
                  )}
                </button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 shadow-lg"
                  onClick={handleImageButtonClick}
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
            </div>

            {/* Gift card / kiosk-ID under the avatar */}
            {participant.gift_card_number && (
              <div className="flex justify-center -mt-1 mb-1">
                <Badge variant="secondary" className="font-mono text-xs">
                  Kiosk-ID: {participant.gift_card_number}
                </Badge>
              </div>
            )}

            {/* Lightbox: full image, no crop */}
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 bg-black/95 border-none">
                {participant.image_url && (
                  <img
                    src={participant.image_url}
                    alt={participant.name}
                    className="w-full max-h-[75vh] object-contain"
                  />
                )}
                <div
                  className="flex justify-center"
                  style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
                >
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setLightboxOpen(false)}
                    className="rounded-full px-8"
                  >
                    Lukk
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Content below image */}
            <div className="p-4 sm:p-6">
              <ResponsiveDialogHeader className="text-center mb-3">
                <ResponsiveDialogTitle className="text-lg sm:text-xl">{participant.name}</ResponsiveDialogTitle>

                <div className="flex justify-center mt-1">
                  <TeamBadge teamId={(participant as any).team_id} size="md" />
                </div>

                {secretWord && (
                  <div className="flex justify-center mt-2">
                    <div className="inline-flex flex-col items-center px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Hemmelig ord</span>
                      <span className="font-mono text-lg font-bold tracking-wider">{secretWord}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground flex-wrap">
                  {participant.birth_date && (
                    <span>{format(new Date(participant.birth_date), 'dd.MM.yyyy')}</span>
                  )}
                  {age !== null && (
                    <>
                      <span>•</span>
                      <span>{age} år</span>
                    </>
                  )}
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
                      {healthInfo.info.replace(/^\[Nurse\]\s*/i, '')}
                    </div>
                  </div>
                )}

                {/* Styrkeprøve badges */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-medium">Styrkeprøve</h4>
                  <StyrkeproveBadges completedActivities={activities.map((a) => a.activity)} />
                </div>

                {/* Insjpoeng */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span>Insjpoeng</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => adjustInsjPoints(-1)}
                      disabled={isUpdatingPoints || (participant.insj_points ?? 0) <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-2xl font-bold tabular-nums">
                      {participant.insj_points ?? 0}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => adjustInsjPoints(1)}
                      disabled={isUpdatingPoints}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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
                    {notesStatus === 'saved' && (
                      <span className="text-xs text-emerald-600">Lagret</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Skriv prestasjoner som kan brukes i pass
                  </p>
                  <Textarea
                    value={activityNotes}
                    onChange={(e) => {
                      isEditingNotesRef.current = true;
                      setActivityNotes(e.target.value);
                    }}
                    onBlur={() => {
                      if (!participant || activityNotes === savedSnapshotRef.current) return;
                      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                      void saveActivityNotes(participant, activityNotes);
                    }}
                    placeholder="F.eks. '1. plass i svømming'..."
                    rows={2}
                    className="text-sm"
                  />
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

                {/* Register incident */}
                <Button variant="outline" className="w-full" onClick={() => setIncidentOpen(true)}>
                  <MessageSquareWarning className="h-4 w-4 mr-2 text-red-600" />
                  Registrer hendelse
                </Button>

                {/* Admin: booking info */}
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={bookingLoading}
                    onClick={async () => {
                      if (!participant) return;
                      setBookingLoading(true);
                      try {
                        const { data: periodRow } = await supabase
                          .from('periods')
                          .select('id')
                          .eq('is_active', true)
                          .maybeSingle();
                        let query = supabase
                          .from('participant_bookings')
                          .select('*')
                          .ilike('first_name', (participant.first_name || '').trim())
                          .ilike('last_name', (participant.last_name || '').trim());
                        if (periodRow?.id) query = query.eq('period_id', periodRow.id);
                        if (participant.birth_date) query = query.eq('birth_date', participant.birth_date);
                        const { data: rows, error } = await query.limit(1);
                        if (error) throw error;
                        const row = rows?.[0];
                        if (!row) {
                          showInfo('Ingen booking', 'Fant ikke booking for denne deltakeren i aktiv periode.');
                          return;
                        }
                        setBookingData(row as Tables<'participant_bookings'>);
                        setBookingOpen(true);
                      } catch (e) {
                        console.error(e);
                        showError('Feil', 'Kunne ikke hente booking.');
                      } finally {
                        setBookingLoading(false);
                      }
                    }}
                  >
                    {bookingLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <BookUser className="h-4 w-4 mr-2" />
                    )}
                    Booking info
                  </Button>
                )}

                {/* Pass written toggle - only visible when checkout is enabled */}
                {checkoutEnabled && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Trophy className="h-4 w-4 text-emerald-600" />
                    <span>Pass</span>
                    {participant.pass_written && (
                      <Badge variant="default" className="text-xs">Skrevet</Badge>
                    )}
                  </div>
                  {(participant.pass_text || participant.pass_suggestion) ? (
                    <div className="p-2.5 bg-muted/40 border rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {participant.pass_text || participant.pass_suggestion}
                      {!participant.pass_text && participant.pass_suggestion && (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          AI-forslag
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ingen passtekst generert ennå. Huk av når passet er skrevet manuelt.
                    </p>
                  )}
                  <Button
                    variant={participant.pass_written ? 'outline' : 'default'}
                    className="w-full"
                    onClick={togglePassWritten}
                    disabled={isTogglingPass}
                  >
                    {isTogglingPass ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : participant.pass_written ? (
                      <XCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {participant.pass_written ? 'Fjern markering' : 'Marker pass som skrevet'}
                  </Button>
                </div>
                )}
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
    {participantId && (
      <IncidentSheet
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        prefillParticipantId={participantId}
      />
    )}
    {bookingOpen && bookingData && participant && (
      <BookingDetailSheet
        booking={bookingData}
        participant={{
          id: participant.id,
          first_name: participant.first_name,
          last_name: participant.last_name,
          birth_date: participant.birth_date,
          image_url: participant.image_url,
        }}
        onClose={() => setBookingOpen(false)}
      />
    )}
    </>
  );
};
