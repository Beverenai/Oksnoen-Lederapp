import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useMemo, useEffect } from 'react';
import { Search, Check, X, Users, Home, Sparkles, ChevronDown, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);

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
    setSelectedActivity(name);
    setSelectedParticipants(new Set());
    setActivityPickerOpen(false);
  };

  const pickCustom = () => {
    setIsCustom(true);
    setSelectedActivity(customName.trim());
    setActivityPickerOpen(false);
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

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Masseregistrering av aktivitet
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-24">
        {/* Activity Selection – searchable */}
        <div className="space-y-2">
          <label className="text-sm font-medium">1. Velg aktivitet</label>
          <Popover open={activityPickerOpen} onOpenChange={setActivityPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-11"
              >
                <span className={cn('truncate', !selectedActivity && 'text-muted-foreground')}>
                  {isCustom
                    ? (customName || 'Egendefinert aktivitet…')
                    : (selectedActivity || 'Velg en aktivitet…')}
                </span>
                <ChevronDown className="w-4 h-4 opacity-60 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-none" align="start">
              <Command>
                <CommandInput placeholder="Søk etter aktivitet…" />
                <CommandList className="max-h-72">
                  <CommandEmpty>Ingen treff</CommandEmpty>
                  {recentActivities.length > 0 && (
                    <CommandGroup heading="Nylig brukt">
                      {recentActivities.map((name) => (
                        <CommandItem key={`recent-${name}`} value={`recent ${name}`} onSelect={() => pickActivity(name)}>
                          <Clock className="w-3.5 h-3.5 mr-2 opacity-60" />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  <CommandGroup heading="Alle aktiviteter">
                    {activities.map((activity) => (
                      <CommandItem
                        key={activity.id}
                        value={activity.title}
                        onSelect={() => pickActivity(activity.title)}
                      >
                        {activity.title}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem value="__custom__ egendefinert" onSelect={pickCustom}>
                      <Sparkles className="w-3.5 h-3.5 mr-2" />
                      Egendefinert aktivitet…
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {isCustom && (
            <Input
              autoFocus
              placeholder="Skriv aktivitetsnavn…"
              maxLength={60}
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                setSelectedActivity(e.target.value.trim());
              }}
            />
          )}
          {selectedActivity && !isCustom && (
            <p className="text-xs text-muted-foreground">
              {activityTotals.done} av {activityTotals.total} har allerede gjort denne •{' '}
              <span className="font-medium text-foreground">{activityTotals.total - activityTotals.done} gjenstår</span>
            </p>
          )}
        </div>

        {selectedActivity && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">2. Huk av deltakere</label>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter deltaker…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>

              {/* Filters row */}
              <div className="grid grid-cols-2 gap-2">
                <Select value={cabinFilter} onValueChange={setCabinFilter}>
                  <SelectTrigger className="h-10">
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
                    <SelectTrigger className="h-10">
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

              {/* Master toggle */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-muted/40">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => (v ? selectAll() : deselectAll())}
                  />
                  Velg alle ({filteredParticipants.length})
                </label>
                <Badge variant="secondary">{selectedParticipants.size} valgt</Badge>
              </div>
            </div>

            {/* Participant List */}
            <div className="max-h-[50vh] overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery
                    ? 'Ingen deltakere funnet'
                    : 'Alle deltakere har allerede gjort denne aktiviteten'}
                </p>
              ) : (
                filteredParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      selectedParticipants.has(participant.id) ? 'bg-primary/10' : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleParticipant(participant.id)}
                  >
                    <Checkbox
                      checked={selectedParticipants.has(participant.id)}
                      onCheckedChange={() => toggleParticipant(participant.id)}
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.image_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {participant.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{participant.name}</p>
                      {participant.cabins && (
                        <p className="text-xs text-muted-foreground">{participant.cabins.name}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Sticky submit bar */}
      {selectedActivity && (
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] rounded-b-lg">
          <Button
            onClick={handleSubmit}
            disabled={selectedParticipants.size === 0 || isSubmitting}
            className="w-full h-12 text-base"
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
    </Card>
  );
}
