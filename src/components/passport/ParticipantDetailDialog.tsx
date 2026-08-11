import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { formatFullRoom, cn } from '@/lib/utils';
import { KioskAccountCard } from '@/components/kiosk/KioskAccountCard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSeasonView } from '@/contexts/SeasonViewContext';
import { fetchSeasonParticipants } from '@/hooks/useSeasonParticipants';
import { Badge } from '@/components/ui/badge';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Camera, CheckCircle, XCircle, Loader2, Heart, Trophy, Plus, Minus, Sparkles, MessageSquareWarning, BookUser, Star, X, ChevronDown, Maximize2 } from 'lucide-react';
import { ActivityManager } from './ActivityManager';
import { StyrkeproveBadges } from './StyrkeproveBadges';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/imageUtils';
import { CachedImage } from '@/components/ui/cached-image';
import { TeamBadge } from '@/components/participants/TeamBadge';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import { IncidentSheet } from '@/components/incidents/IncidentSheet';
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  type IncidentCategory,
  type IncidentSeverity,
} from '@/hooks/useParticipantIncidents';
import { BookingDetailSheet } from '@/components/admin/bookings/BookingDetailSheet';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { useParticipantBonusPoints } from '@/hooks/useParticipantBonusPoints';
import { BONUS_ACTIVITIES } from '@/lib/bonusActivities';
import { computeParticipantPoints } from '@/lib/participantPoints';
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
  image_aged_url?: string | null;
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
async function fetchParticipantDetail(participantId: string, seasonView = false): Promise<{
  participant: ParticipantWithCabin;
  healthInfo: HealthInfo | null;
  activities: ParticipantActivity[];
}> {
  // In season view the participant may belong to an older period, which RLS hides
  // from a direct select — read it through the read-only season function instead.
  if (seasonView) {
    const [all, activitiesSeason, healthSeason] = await Promise.all([
      fetchSeasonParticipants(),
      supabase.from('participant_activities').select('*').eq('participant_id', participantId),
      supabase.from('participant_health_info').select('*').eq('participant_id', participantId).maybeSingle(),
    ]);
    const row: any = all.find((p) => p.id === participantId);
    if (!row) throw new Error('Deltager ikke funnet');
    return {
      participant: { ...row, cabin: row.cabins ?? null } as ParticipantWithCabin,
      healthInfo: healthSeason.data as HealthInfo | null,
      activities: (activitiesSeason.data || []) as ParticipantActivity[],
    };
  }

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

function ParticipantTotalPoints({
  participantId,
  activities,
  insjPoints,
}: {
  participantId: string;
  activities: Array<{ activity: string }>;
  insjPoints: number;
}) {
  const { data: rows = [] } = useParticipantBonusPoints(participantId);
  const bonusPoints = (rows as Array<{ points: number }>).reduce(
    (sum, r) => sum + (r.points || 0),
    0,
  );
  const { activities: actPts, secretWord, bonus, total } = computeParticipantPoints({
    activities,
    insjPoints,
    bonusPoints,
  });
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-medium">Totalt poeng</span>
        </div>
        <span className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
          {total}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="rounded-lg bg-background/60 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Aktivitet</div>
          <div className="text-base font-semibold tabular-nums">{actPts}</div>
        </div>
        <div className="rounded-lg bg-background/60 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Insj</div>
          <div className="text-base font-semibold tabular-nums">{secretWord}</div>
        </div>
        <div className="rounded-lg bg-background/60 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bonus</div>
          <div className="text-base font-semibold tabular-nums">{bonus}</div>
        </div>
      </div>
    </div>
  );
}

function BonusPointsSection({
  participantId,
  teamId,
  isAdmin,
  currentLeaderId,
}: {
  participantId: string;
  teamId: string | null;
  isAdmin: boolean;
  currentLeaderId: string | null;
}) {
  const { data: rows = [], addBonus, removeBonus } = useParticipantBonusPoints(participantId);
  const { readOnly } = useSeasonView();
  const { showSuccess, showError } = useStatusPopup();
  const total = rows.reduce((sum, r) => sum + r.points, 0);
  const [open, setOpen] = useState(false);
  const extraActivities = BONUS_ACTIVITIES.filter((a) => !!a.extra);

  const handleAdd = async (activityKey: string, activityLabel: string) => {
    const points = 2;
    try {
      await addBonus.mutateAsync({ activityKey, activityLabel, variant: 'extra', points, teamId });
      hapticSuccess();
      showSuccess('Poeng tildelt', `+${points} for ${activityLabel}`);
    } catch (e: any) {
      hapticError();
      showError('Feil', e?.message ?? 'Kunne ikke tildele poeng');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeBonus.mutateAsync(id);
      hapticSuccess();
    } catch (e: any) {
      showError('Feil', e?.message ?? 'Kunne ikke fjerne');
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-11">
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Ekstra poeng
          </span>
          <Badge variant="secondary" className="tabular-nums">{total} p</Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Ekstra poeng
            <Badge variant="secondary" className="tabular-nums ml-auto">{total} p</Badge>
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-3">
          <p className="text-xs text-muted-foreground">
            Vanlige aktiviteter registreres i «Aktiviteter». Her gir du +2 for ekstra-varianter.
          </p>
          <div className="rounded-lg border divide-y overflow-hidden">
            {extraActivities.map((a) => (
              <div key={a.key} className="flex items-center gap-2 p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.extra}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 shrink-0"
                  onClick={() => handleAdd(a.key, `${a.label} — ${a.extra}`)}
                  disabled={addBonus.isPending || readOnly}
                >
                  +2
                </Button>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs text-muted-foreground">Tildelt</p>
              {rows.map((r) => {
                const canDelete = !readOnly && (isAdmin || (currentLeaderId && r.awarded_by === currentLeaderId));
                return (
                  <div key={r.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/40">
                    <Badge variant="default" className="tabular-nums">+{r.points}</Badge>
                    <span className="flex-1 truncate">{r.activity_label}</span>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleRemove(r.id)}
                        aria-label="Fjern"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const ParticipantDetailDialog = ({
  participantId,
  open,
  onOpenChange,
  onParticipantUpdated,
}: ParticipantDetailDialogProps) => {
  const { leader, isAdmin, isNurse } = useAuth();
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const queryClient = useQueryClient();
  const teamsEnabled = useTeamsEnabled();
  const [activityNotes, setActivityNotes] = useState('');
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTogglingArrival, setIsTogglingArrival] = useState(false);
  const [isTogglingPass, setIsTogglingPass] = useState(false);
  const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showAged, setShowAged] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingData, setBookingData] = useState<Tables<'participant_bookings'> | null>(null);
  const [showNurseInfo, setShowNurseInfo] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSnapshotRef = useRef<string>('');
  const isEditingNotesRef = useRef(false);

  const { readOnly, seasonView } = useSeasonView();

  // Fetch participant detail with caching
  const { data, isLoading, refetch: refetchParticipant } = useQuery({
    queryKey: ['participant-detail-v2', participantId, seasonView ? 'season' : 'active'],
    queryFn: () => fetchParticipantDetail(participantId!, seasonView),
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

  // Admin/Nurse: incidents registered on this participant
  const { data: participantIncidents = [] } = useQuery({
    queryKey: ['participant-incidents-detail', participantId],
    enabled: open && !!participantId && (isAdmin || isNurse),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('participant_incident_participants')
        .select(
          'participant_incidents(id, title, description, category, severity, created_at, leader:leaders(id, name))'
        )
        .eq('participant_id', participantId);
      if (error) throw error;
      return ((data || []) as any[])
        .map((r) => r.participant_incidents)
        .filter(Boolean)
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) as Array<{
        id: string;
        title: string;
        description: string | null;
        category: IncidentCategory;
        severity: IncidentSeverity;
        created_at: string;
        leader?: { id: string; name: string } | null;
      }>;
    },
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
    setShowNurseInfo(false);
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
                  onClick={() => {
                    if (!participant.image_url) return;
                    if (participant.image_aged_url) {
                      setShowAged((v) => !v);
                    } else {
                      setLightboxOpen(true);
                    }
                  }}
                  disabled={!participant.image_url}
                  className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden bg-muted ring-2 ring-border shadow-md disabled:cursor-default focus:outline-none focus:ring-4 focus:ring-primary/40 transition-transform duration-500 [transform-style:preserve-3d]"
                  style={showAged ? { transform: 'rotateY(180deg)' } : undefined}
                  aria-label={
                    participant.image_aged_url
                      ? showAged
                        ? 'Vis dagens bilde'
                        : 'Vis eldre versjon'
                      : participant.image_url
                        ? 'Vis bilde'
                        : 'Ingen bilde'
                  }
                >
                  {showAged && participant.image_aged_url ? (
                    <img
                      src={participant.image_aged_url}
                      alt={`${participant.name} – eldre versjon`}
                      className="w-full h-full object-cover"
                      style={{ transform: 'rotateY(180deg)' }}
                    />
                  ) : participant.image_url ? (
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
                {participant.image_url && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-0 left-0 rounded-full h-8 w-8 shadow-lg"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Vis bildet større"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 shadow-lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage || readOnly}
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
            {participant.image_aged_url && (
              <div className="flex justify-center mb-1">
                <Badge variant={showAged ? 'default' : 'secondary'} className="text-[11px]">
                  {showAged ? 'Gammel – trykk for å bytte tilbake' : 'Trykk bildet: ung/gammel · lupe for større'}
                </Badge>
              </div>
            )}
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
                {(() => {
                  const src = showAged && participant.image_aged_url ? participant.image_aged_url : participant.image_url;
                  return src ? (
                    <img
                      src={src}
                      alt={participant.name}
                      className="w-full max-h-[75vh] object-contain"
                    />
                  ) : null;
                })()}
                <div
                  className="flex flex-wrap justify-center gap-2 px-4"
                  style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
                >
                  {participant.image_aged_url && (
                    <Button
                      variant={showAged ? 'default' : 'outline'}
                      size="lg"
                      onClick={() => setShowAged((v) => !v)}
                      className="rounded-full px-6"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {showAged ? 'Vis ung' : 'Vis gammel'}
                    </Button>
                  )}
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
                {/* Total poeng — kun når Lag er aktivt */}
                {teamsEnabled && (
                  <ParticipantTotalPoints
                    participantId={participant.id}
                    activities={activities}
                    insjPoints={participant.insj_points ?? 0}
                  />
                )}

                {/* Info fra Nurse */}
                {healthInfo?.info && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowNurseInfo((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition"
                    >
                      <Heart className="h-3.5 w-3.5" />
                      Info fra Nurse
                      <ChevronDown
                        className={cn('h-3.5 w-3.5 transition-transform', showNurseInfo && 'rotate-180')}
                      />
                    </button>
                    {showNurseInfo && (
                      <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                        {healthInfo.info.replace(/^\[Nurse\]\s*/i, '')}
                      </div>
                    )}
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

                {/* Ekstra poeng — kun når Lag er aktivt */}
                {teamsEnabled && (
                  <BonusPointsSection
                    participantId={participant.id}
                    teamId={(participant as any).team_id ?? null}
                    isAdmin={isAdmin}
                    currentLeaderId={leader?.id ?? null}
                  />
                )}

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
                    readOnly={readOnly}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Arrival toggle */}
                <Button
                  variant={participant.has_arrived ? 'outline' : 'default'}
                  className="w-full"
                  onClick={toggleArrival}
                  disabled={isTogglingArrival || readOnly}
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

                {/* Admin/Nurse: registered incidents */}
                {(isAdmin || isNurse) && participantIncidents.length > 0 && (
                  <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Hendelser ({participantIncidents.length})
                    </p>
                    {participantIncidents.map((inc) => (
                      <div key={inc.id} className="rounded-xl bg-background/70 p-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{inc.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {format(new Date(inc.created_at), 'dd.MM.yy HH:mm')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[inc.category]}`}>
                            {CATEGORY_LABELS[inc.category]}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLORS[inc.severity]}`}>
                            {SEVERITY_LABELS[inc.severity]}
                          </Badge>
                        </div>
                        {inc.description && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{inc.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Skrevet av <span className="font-medium">{inc.leader?.name ?? 'Ukjent'}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Register incident */}
                <Button variant="outline" className="w-full" disabled={readOnly} onClick={() => setIncidentOpen(true)}>
                  <MessageSquareWarning className="h-4 w-4 mr-2 text-red-600" />
                  Registrer hendelse
                </Button>

                {/* Admin/Nurse: booking info (guardian contact) */}
                {(isAdmin || isNurse) && (
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
                         const firstFull = (participant.first_name || '').trim();
                         const lastFull = (participant.last_name || '').trim();
                         const firstToken = firstFull.split(/\s+/)[0] || firstFull;
                         const lastToken = lastFull.split(/\s+/).slice(-1)[0] || lastFull;

                         const runQuery = async (opts: { firstPattern: string; lastPattern: string; useDob: boolean }) => {
                           let q = supabase.from('participant_bookings').select('*');
                           if (periodRow?.id) q = q.eq('period_id', periodRow.id);
                           q = q.ilike('first_name', opts.firstPattern).ilike('last_name', opts.lastPattern);
                           if (opts.useDob && participant.birth_date) q = q.eq('birth_date', participant.birth_date);
                           const { data, error } = await q.limit(1);
                           if (error) throw error;
                           return data?.[0];
                         };

                         // Try progressively looser matches
                         let row =
                           (await runQuery({ firstPattern: firstFull, lastPattern: lastFull, useDob: true })) ||
                           (await runQuery({ firstPattern: firstFull, lastPattern: lastFull, useDob: false })) ||
                           (await runQuery({ firstPattern: `${firstToken}%`, lastPattern: `%${lastToken}`, useDob: true })) ||
                           (await runQuery({ firstPattern: `${firstToken}%`, lastPattern: `%${lastToken}`, useDob: false }));

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

                <KioskAccountCard participantId={participant.id} />

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
                    disabled={isTogglingPass || readOnly}
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
