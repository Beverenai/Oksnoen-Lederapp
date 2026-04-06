import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, AlertCircle, Cake, ChevronDown, ChevronUp, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, differenceInYears } from 'date-fns';
import { nb } from 'date-fns/locale';
import { AgeDistributionChart } from '@/components/stats/AgeDistributionChart';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
interface Participant {
  id: string;
  name: string;
  first_name: string | null;
  birth_date: string | null;
  has_arrived: boolean | null;
  cabin_id: string | null;
}

interface Cabin {
  id: string;
  name: string;
}

interface ParticipantActivity {
  participant_id: string;
}

interface UpcomingBirthday {
  participant: Participant;
  cabinName: string | null;
  age: number;
  daysUntil: number;
  birthdayDate: Date;
}

interface MissingActivityParticipant {
  participant: Participant;
  cabinName: string | null;
  age: number | null;
}

export function ParticipantStatsCard() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [activities, setActivities] = useState<ParticipantActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMissingOpen, setIsMissingOpen] = useState(false);
  const [isBirthdaysOpen, setIsBirthdaysOpen] = useState(true);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [participantsRes, cabinsRes, activitiesRes] = await Promise.all([
        supabase.from('participants').select('id, name, first_name, birth_date, has_arrived, cabin_id'),
        supabase.from('cabins').select('id, name'),
        supabase.from('participant_activities').select('participant_id'),
      ]);

      setParticipants(participantsRes.data || []);
      setCabins(cabinsRes.data || []);
      setActivities(activitiesRes.data || []);
    } catch (error) {
      console.error('Error loading participant stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCabinName = (cabinId: string | null): string | null => {
    if (!cabinId) return null;
    const cabin = cabins.find(c => c.id === cabinId);
    return cabin?.name || null;
  };

  const calculateAge = (birthDate: string): number => {
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getUpcomingBirthdays = (daysAhead: number = 9): UpcomingBirthday[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const birthdays: UpcomingBirthday[] = [];

    participants.forEach(p => {
      if (!p.birth_date) return;

      const birth = new Date(p.birth_date);
      const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      
      // If birthday has passed this year, check next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = thisYearBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= daysAhead) {
        const turningAge = thisYearBirthday.getFullYear() - birth.getFullYear();
        birthdays.push({
          participant: p,
          cabinName: getCabinName(p.cabin_id),
          age: turningAge,
          daysUntil: diffDays,
          birthdayDate: thisYearBirthday,
        });
      }
    });

    // Sort by days until birthday
    return birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
  };

  const getMissingActivityParticipants = (): MissingActivityParticipant[] => {
    const participantsWithActivities = new Set(activities.map(a => a.participant_id));
    
    return participants
      .filter(p => p.has_arrived && !participantsWithActivities.has(p.id))
      .map(p => ({
        participant: p,
        cabinName: getCabinName(p.cabin_id),
        age: p.birth_date ? calculateAge(p.birth_date) : null,
      }));
  };

  // Stats calculations
  const totalParticipants = participants.length;
  const arrivedParticipants = participants.filter(p => p.has_arrived).length;
  const arrivalPercentage = totalParticipants > 0 ? (arrivedParticipants / totalParticipants) * 100 : 0;
  const missingActivities = getMissingActivityParticipants();
  const upcomingBirthdays = getUpcomingBirthdays(9);

  const formatBirthdayText = (birthday: UpcomingBirthday): string => {
    if (birthday.daysUntil === 0) {
      return `fyller ${birthday.age} år i dag! 🎉`;
    } else if (birthday.daysUntil === 1) {
      return `fyller ${birthday.age} år i morgen`;
    } else {
      return `fyller ${birthday.age} år ${format(birthday.birthdayDate, 'd. MMMM', { locale: nb })}`;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5" />
            Deltakerstatistikk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5" />
            Oversikt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Arrival Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-4 h-4 text-muted-foreground" />
                Ankomst
              </div>
              <span className="text-sm text-muted-foreground">
                {arrivedParticipants} / {totalParticipants} ({arrivalPercentage.toFixed(0)}%)
              </span>
            </div>
            <Progress value={arrivalPercentage} className="h-2" />
          </div>

        {/* Missing Activities */}
        {missingActivities.length > 0 && (
          <Collapsible open={isMissingOpen} onOpenChange={setIsMissingOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">Mangler aktivitetsregistrering</span>
                <Badge variant="secondary" className="ml-1">
                  {missingActivities.length}
                </Badge>
              </div>
              {isMissingOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-1.5 pl-6 max-h-40 overflow-y-auto">
                {missingActivities.map(({ participant, cabinName, age }) => (
                  <button
                    key={participant.id}
                    onClick={() => handleParticipantClick(participant.id)}
                    className="text-sm flex items-center gap-2 w-full text-left hover:bg-muted/50 p-1 rounded transition-colors"
                  >
                    <span className="font-medium">
                      {participant.first_name || participant.name}
                    </span>
                    {age !== null && (
                      <span className="text-muted-foreground">({age} år)</span>
                    )}
                    {cabinName && (
                      <Badge variant="outline" className="text-xs">
                        {cabinName}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Upcoming Birthdays */}
        {upcomingBirthdays.length > 0 && (
          <Collapsible open={isBirthdaysOpen} onOpenChange={setIsBirthdaysOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">Bursdager de neste 9 dagene</span>
                <Badge variant="secondary" className="ml-1">
                  {upcomingBirthdays.length}
                </Badge>
              </div>
              {isBirthdaysOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-1.5 pl-6 max-h-40 overflow-y-auto">
                {upcomingBirthdays.map(birthday => (
                  <button
                    key={birthday.participant.id}
                    onClick={() => handleParticipantClick(birthday.participant.id)}
                    className="text-sm flex items-center gap-2 flex-wrap w-full text-left hover:bg-muted/50 p-1 rounded transition-colors"
                  >
                    <span className="font-medium">
                      {birthday.participant.first_name || birthday.participant.name}
                    </span>
                    <span className="text-muted-foreground">
                      - {formatBirthdayText(birthday)}
                    </span>
                    {birthday.cabinName && (
                      <Badge variant="outline" className="text-xs">
                        {birthday.cabinName}
                      </Badge>
                    )}
                    {birthday.daysUntil <= 1 && (
                      <Badge className="bg-pink-500 text-white text-xs">
                        {birthday.daysUntil === 0 ? 'I dag!' : 'I morgen'}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

          {/* No upcoming events */}
          {missingActivities.length === 0 && upcomingBirthdays.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Ingen ventende handlinger
            </p>
          )}
        </CardContent>
      </Card>

      {/* Age Distribution Chart */}
      <AgeDistributionChart participants={participants} />

      {/* Participant Detail Dialog */}
      <ParticipantDetailDialog
        participantId={selectedParticipantId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onParticipantUpdated={() => loadData(false)}
      />
    </div>
  );
}
