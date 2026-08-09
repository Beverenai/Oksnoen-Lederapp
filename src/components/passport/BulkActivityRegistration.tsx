import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useMemo, useEffect } from 'react';
import { Search, Check, X, Users, Home, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useActivities } from '@/hooks/useActivities';
import { useParticipantTeams } from '@/hooks/useParticipantTeams';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import type { Tables } from '@/integrations/supabase/types';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
  participant_activities?: { activity: string; completed_at?: string }[];
}

interface BulkActivityRegistrationProps {
  participants: ParticipantWithCabin[];
  onComplete: () => void;
  onClose: () => void;
}

export function BulkActivityRegistration({
  participants,
  onComplete,
  onClose,
}: BulkActivityRegistrationProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { leader } = useAuth();
  const { activities } = useActivities(true);
  const teamsEnabled = useTeamsEnabled();
  const { data: teams = [] } = useParticipantTeams();
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [cabinFilter, setCabinFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');

  // Recent activities: unique names most recently registered across all participants
  const recentActivities = useMemo(() => {
    const seen = new Map<string, number>(); // name -> latest time
    participants.forEach((p) => {
      (p.participant_activities || []).forEach((a) => {
        const t = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const prev = seen.get(a.activity) ?? 0;
        if (t > prev) seen.set(a.activity, t);
      });
    });
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }, [participants]);

  // Unique cabins from participants list, sorted (no)
  const availableCabins = useMemo(() => {
    const names = new Set<string>();
    participants.forEach((p) => {
      const name = p.cabins?.name?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'nb'));
  }, [participants]);

  // Totals for the currently selected activity (unfiltered)
  const activityTotals = useMemo(() => {
    if (!selectedActivity) return { done: 0, total: participants.length };
    let done = 0;
    participants.forEach((p) => {
      if (p.participant_activities?.some((a) => a.activity.toLowerCase() === selectedActivity.toLowerCase())) done++;
    });
    return { done, total: participants.length };
  }, [participants, selectedActivity]);

  // Filter participants based on search + filters + hides who already did activity
  const filteredParticipants = useMemo(() => {
    if (!selectedActivity) return [];
    const q = searchQuery.trim().toLowerCase();
    return participants.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const matchesCabin =
        cabinFilter === 'all' ||
        (cabinFilter === 'none' && !p.cabins?.name) ||
        p.cabins?.name === cabinFilter;
      const matchesTeam =
        teamFilter === 'all' ||
        (teamFilter === 'none' && !(p as any).team_id) ||
        (p as any).team_id === teamFilter;
      const hasActivity = p.participant_activities?.some(
        (a) => a.activity.toLowerCase() === selectedActivity.toLowerCase()
      );
      return matchesSearch && matchesCabin && matchesTeam && !hasActivity;
    });
  }, [participants, selectedActivity, searchQuery, cabinFilter, teamFilter]);

  const pickActivity = (name: string) => {
    setIsCustom(false);
    setCustomName('');
    setSelectedActivity((prev) => (prev.toLowerCase() === name.toLowerCase() ? '' : name));
    setSelectedParticipants(new Set());
  };

  const pickCustom = () => {
    setIsCustom(true);
    setSelectedActivity(customName.trim());
  };

  const handleCustomNameChange = (value: string) => {
    setCustomName(value);
    setSelectedActivity(value.trim());
  };

  const toggleParticipant = (id: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
  };

  const selectAll = () => setSelectedParticipants(new Set(filteredParticipants.map((p) => p.id)));
  const deselectAll = () => setSelectedParticipants(new Set());
  const allSelected =
    filteredParticipants.length > 0 && selectedParticipants.size === filteredParticipants.length;

  const handleSubmit = async () => {
    if (!selectedActivity || selectedParticipants.size === 0) return;

    setIsSubmitting(true);
    try {
      const activityName = (isCustom ? customName : selectedActivity).trim();
      if (!activityName) {
        showError('Aktivitetsnavnet kan ikke være tomt');
        hapticError();
        setIsSubmitting(false);
        return;
      }
      const inserts = Array.from(selectedParticipants).map((participantId) => ({
        participant_id: participantId,
        activity: activityName,
        registered_by: leader?.id,
      }));

      const { error } = await supabase.from('participant_activities').insert(inserts);

      if (error) throw error;

      const successMessage = `${activityName} registrert for ${selectedParticipants.size} deltakere!`;
      showSuccess(successMessage);
      toast.success(successMessage);
      hapticSuccess();

      setSelectedParticipants(new Set());
      setSelectedActivity('');
      setCustomName('');
      setIsCustom(false);
      onComplete();
    } catch (error) {
      console.error('Error registering activities:', error);
      showError('Kunne ikke registrere aktiviteter');
      toast.error('Kunne ikke registrere aktiviteter');
      hapticError();
    } finally {
      setIsSubmitting(false);
    }
  };

  const doneCounts = useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((p) => {
      const seen = new Set<string>();
      (p.participant_activities || []).forEach((a) => {
        const k = a.activity.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        map.set(k, (map.get(k) || 0) + 1);
      });
    });
    return map;
  }, [participants]);

  const visibleActivities = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    const list = q ? activities.filter((a) => a.title.toLowerCase().includes(q)) : activities;
    const recentSet = new Set(recentActivities.map((r) => r.toLowerCase()));
    return [...list].sort((a, b) => {
      const ra = recentSet.has(a.title.toLowerCase()) ? 0 : 1;
      const rb = recentSet.has(b.title.toLowerCase()) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title, 'nb');
    });
  }, [activities, activitySearch, recentActivities]);

  const remaining = activityTotals.total - activityTotals.done;
  const progress = activityTotals.total ? Math.round((activityTotals.done / activityTotals.total) * 100) : 0;

  return (
    <div className="space-y-3 pb-28">
      {/* Header */}
      <div className="ios-surface px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Registrer aktivitet</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {selectedActivity ? `${remaining} gjenstår på ${selectedActivity}` : 'Velg aktivitet under'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Activity picker — floating chips */}
      <div className="ios-surface p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Søk aktivitet…"
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            className="pl-10 h-11 rounded-2xl bg-muted/50 border-0"
          />
        </div>

        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto overscroll-contain">
          {visibleActivities.map((activity) => {
            const active = !isCustom && selectedActivity.toLowerCase() === activity.title.toLowerCase();
            const done = doneCounts.get(activity.title.toLowerCase()) || 0;
            const isRecent = recentActivities.some((r) => r.toLowerCase() === activity.title.toLowerCase());
            return (
              <button
                key={activity.id}
                type="button"
                onClick={() => pickActivity(activity.title)}
                className={cn(
                  'ios-chip flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium border',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                    : 'bg-muted/50 text-foreground border-border/50'
                )}
              >
                {active ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isRecent ? (
                  <Clock className="w-3.5 h-3.5 opacity-60" />
                ) : null}
                <span className="truncate max-w-[10rem]">{activity.title}</span>
                {done > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold rounded-full px-1.5 py-0.5',
                      active ? 'bg-primary-foreground/20' : 'bg-background/70 text-muted-foreground'
                    )}
                  >
                    {done}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={pickCustom}
            className={cn(
              'ios-chip flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium border border-dashed',
              isCustom ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Egendefinert
          </button>

          {visibleActivities.length === 0 && !isCustom && (
            <p className="text-sm text-muted-foreground py-2 px-1">Ingen treff</p>
          )}
        </div>

        {isCustom && (
          <Input
            autoFocus
            placeholder="Skriv aktivitetsnavn…"
            maxLength={60}
            value={customName}
            onChange={(e) => handleCustomNameChange(e.target.value)}
            className="h-11 rounded-2xl bg-muted/50 border-0"
          />
        )}

        {selectedActivity && !isCustom && (
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {activityTotals.done} av {activityTotals.total} har gjort denne •{' '}
              <span className="font-semibold text-foreground">{remaining} gjenstår</span>
            </p>
          </div>
        )}
      </div>

      {selectedActivity && (
        <div className="ios-surface p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Søk deltaker…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-muted/50 border-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={cabinFilter} onValueChange={setCabinFilter}>
              <SelectTrigger className="h-10 rounded-2xl bg-muted/50 border-0">
                <Home className="w-3.5 h-3.5 mr-1 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle hytter</SelectItem>
                {availableCabins.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="none">Uten hytte</SelectItem>
              </SelectContent>
            </Select>
            {teamsEnabled && teams.length > 0 ? (
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-10 rounded-2xl bg-muted/50 border-0">
                  <Users className="w-3.5 h-3.5 mr-1 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle lag</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="none">Uten lag</SelectItem>
                </SelectContent>
              </Select>
            ) : <div />}
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-muted/40">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => (v ? selectAll() : deselectAll())}
              />
              Velg alle ({filteredParticipants.length})
            </label>
            <Badge variant="secondary" className="rounded-full">{selectedParticipants.size} valgt</Badge>
          </div>

          <div className="max-h-[52vh] overflow-y-auto overscroll-contain space-y-1.5">
            {filteredParticipants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {searchQuery ? 'Ingen deltakere funnet' : 'Alle har allerede gjort denne aktiviteten'}
              </p>
            ) : (
              filteredParticipants.map((participant) => {
                const checked = selectedParticipants.has(participant.id);
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => toggleParticipant(participant.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 pr-3 rounded-2xl text-left transition-all active:scale-[0.99]',
                      checked
                        ? 'bg-primary/10 ring-1 ring-primary/40'
                        : 'bg-muted/30 hover:bg-muted/60'
                    )}
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={participant.image_url || undefined} />
                      <AvatarFallback className="text-xs">{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{participant.name}</p>
                      {participant.cabins && (
                        <p className="text-xs text-muted-foreground truncate">{participant.cabins.name}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors',
                        checked ? 'bg-primary text-primary-foreground' : 'border border-border/70'
                      )}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating submit pill */}
      {selectedActivity && (
        <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pointer-events-none">
          <Button
            onClick={handleSubmit}
            disabled={selectedParticipants.size === 0 || isSubmitting}
            className="pointer-events-auto w-full max-w-xl mx-auto h-14 rounded-full text-base font-semibold shadow-xl shadow-primary/30"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="w-5 h-5 mr-2" />
            )}
            Registrer {selectedParticipants.size > 0 ? `${selectedParticipants.size} deltaker${selectedParticipants.size === 1 ? '' : 'e'}` : 'deltakere'}
          </Button>
        </div>
      )}
    </div>
  );
}
