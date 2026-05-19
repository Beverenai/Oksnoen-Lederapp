import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useMemo } from 'react';
import { Search, Check, X, Users, Home, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useActivities } from '@/hooks/useActivities';
import type { Tables } from '@/integrations/supabase/types';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
  participant_activities?: Tables<'participant_activities'>[];
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
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [cabinFilter, setCabinFilter] = useState<string>('all');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unique cabins from participants list, sorted (no)
  const availableCabins = useMemo(() => {
    const names = new Set<string>();
    participants.forEach((p) => {
      const name = p.cabins?.name?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'nb'));
  }, [participants]);

  // Filter participants based on search and who hasn't done the activity
  const filteredParticipants = useMemo(() => {
    if (!selectedActivity) return [];

    return participants.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCabin =
        cabinFilter === 'all' ||
        (cabinFilter === 'none' && !p.cabins?.name) ||
        p.cabins?.name === cabinFilter;
      const hasActivity = p.participant_activities?.some(
        (a) => a.activity.toLowerCase() === selectedActivity.toLowerCase()
      );
      return matchesSearch && matchesCabin && !hasActivity;
    });
  }, [participants, selectedActivity, searchQuery, cabinFilter]);

  const handleActivityChange = (value: string) => {
    if (value === '__custom__') {
      setIsCustom(true);
      setSelectedActivity(customName.trim());
    } else {
      setIsCustom(false);
      setCustomName('');
      setSelectedActivity(value);
    }
    setSelectedParticipants(new Set());
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

  const selectAll = () => {
    setSelectedParticipants(new Set(filteredParticipants.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedParticipants(new Set());
  };

  const handleSubmit = async () => {
    if (!selectedActivity || selectedParticipants.size === 0) return;

    setIsSubmitting(true);
    try {
      const activityName = (isCustom ? customName : selectedActivity).trim();
      if (!activityName) {
        showError('Aktivitetsnavnet kan ikke være tomt');
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

      showSuccess(`${activityName} registrert for ${selectedParticipants.size} deltakere!`);
      setSelectedParticipants(new Set());
      setSelectedActivity('');
      setCustomName('');
      setIsCustom(false);
      onComplete();
    } catch (error) {
      console.error('Error registering activities:', error);
      showError('Kunne ikke registrere aktiviteter');
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
      <CardContent className="space-y-4">
        {/* Activity Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Velg aktivitet</label>
          <Select
            value={isCustom ? '__custom__' : selectedActivity}
            onValueChange={handleActivityChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Velg en aktivitet..." />
            </SelectTrigger>
            <SelectContent>
              {activities.map((activity) => (
                <SelectItem key={activity.id} value={activity.title}>
                  {activity.title}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Egendefinert aktivitet…
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {isCustom && (
            <Input
              autoFocus
              placeholder="Skriv aktivitetsnavn..."
              maxLength={60}
              value={customName}
              onChange={(e) => handleCustomNameChange(e.target.value)}
            />
          )}
        </div>

        {selectedActivity && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter deltaker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Cabin filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Home className="w-3 h-3" /> Filtrer på hytte
              </label>
              <Select value={cabinFilter} onValueChange={setCabinFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle hytter</SelectItem>
                  {availableCabins.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Uten hytte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Select all / Deselect all */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Velg alle ({filteredParticipants.length})
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Fjern valg
              </Button>
            </div>

            {/* Participant List */}
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
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
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
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

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={selectedParticipants.size === 0 || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Registrer {selectedParticipants.size} deltakere
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
