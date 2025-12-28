import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  CheckCircle2, 
  Circle,
  User,
  Home,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { StyrkeproveBadges } from '@/components/passport/StyrkeproveBadges';
import { BulkActivityRegistration } from '@/components/passport/BulkActivityRegistration';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;
type ParticipantActivity = Tables<'participant_activities'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
  participant_activities?: ParticipantActivity[];
}

interface CabinGroup {
  cabin: Cabin;
  participants: ParticipantWithCabin[];
}

const calculateAge = (birthDate: string): number => {
  return differenceInYears(new Date(), new Date(birthDate));
};

export default function Passport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cabinFilterFromUrl = searchParams.get('cabin');
  
  const [participants, setParticipants] = useState<ParticipantWithCabin[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCabin, setFilterCabin] = useState<string>(cabinFilterFromUrl || 'all');
  const [filterArrival, setFilterArrival] = useState<string>('all');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [expandedCabins, setExpandedCabins] = useState<Set<string>>(new Set());
  const [showBulkRegistration, setShowBulkRegistration] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Sync filterCabin with URL parameter
  useEffect(() => {
    if (cabinFilterFromUrl) {
      setFilterCabin(cabinFilterFromUrl);
    }
  }, [cabinFilterFromUrl]);

  const clearCabinFilter = () => {
    setFilterCabin('all');
    setSearchParams({});
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [participantsRes, cabinsRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, cabins(*), participant_activities(*)')
          .order('name'),
        supabase.from('cabins').select('*').order('name', { ascending: true }),
      ]);

      setParticipants(participantsRes.data || []);
      setCabins(cabinsRes.data || []);
      
      // Expand all cabins by default, or just the filtered one
      if (cabinsRes.data) {
        if (cabinFilterFromUrl) {
          setExpandedCabins(new Set([cabinFilterFromUrl]));
        } else {
          setExpandedCabins(new Set(cabinsRes.data.map(c => c.id)));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };
  // Handler for opening participant detail dialog
  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setIsDetailDialogOpen(true);
  };

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesName = p.name.toLowerCase().includes(query);
      const cabinName = p.cabins?.name?.toLowerCase() || '';
      const matchesCabinSearch = cabinName.includes(query);
      const matchesSearch = matchesName || matchesCabinSearch;
      const matchesCabin = filterCabin === 'all' || p.cabin_id === filterCabin;
      const matchesArrival = 
        filterArrival === 'all' ||
        (filterArrival === 'arrived' && p.has_arrived) ||
        (filterArrival === 'not-arrived' && !p.has_arrived);
      
      return matchesSearch && matchesCabin && matchesArrival;
    });
  }, [participants, searchQuery, filterCabin, filterArrival]);

  // Group participants by cabin
  const cabinGroups = useMemo((): CabinGroup[] => {
    const groups: CabinGroup[] = [];
    const cabinMap = new Map<string, ParticipantWithCabin[]>();
    const uncategorized: ParticipantWithCabin[] = [];

    filteredParticipants.forEach(p => {
      if (p.cabin_id && p.cabins) {
        const existing = cabinMap.get(p.cabin_id) || [];
        existing.push(p);
        cabinMap.set(p.cabin_id, existing);
      } else {
        uncategorized.push(p);
      }
    });

    cabins.forEach(cabin => {
      const cabinParticipants = cabinMap.get(cabin.id);
      if (cabinParticipants && cabinParticipants.length > 0) {
        groups.push({ cabin, participants: cabinParticipants });
      }
    });

    if (uncategorized.length > 0) {
      groups.push({
        cabin: { id: 'uncategorized', name: 'Uten hytte', sort_order: 999, created_at: null },
        participants: uncategorized
      });
    }

    return groups;
  }, [filteredParticipants, cabins]);

  const arrivedCount = participants.filter((p) => p.has_arrived).length;

  const toggleCabinExpanded = (cabinId: string) => {
    const newExpanded = new Set(expandedCabins);
    if (newExpanded.has(cabinId)) {
      newExpanded.delete(cabinId);
    } else {
      newExpanded.add(cabinId);
    }
    setExpandedCabins(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  // Get the filtered cabin name for display
  const filteredCabinName = cabinFilterFromUrl 
    ? cabins.find(c => c.id === cabinFilterFromUrl)?.name 
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button when filtered by cabin */}
      {cabinFilterFromUrl && (
        <Button variant="ghost" onClick={clearCabinFilter} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tilbake til alle hytter
        </Button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            {filteredCabinName ? `${filteredCabinName}` : 'Passkontroll'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {arrivedCount} av {participants.length} deltakere har ankommet
          </p>
        </div>

        <Button
          variant={showBulkRegistration ? 'secondary' : 'outline'}
          onClick={() => setShowBulkRegistration(!showBulkRegistration)}
        >
          <Users className="w-4 h-4 mr-2" />
          {showBulkRegistration ? 'Skjul' : 'Registrer aktivitet'}
        </Button>
      </div>

      {/* Bulk Activity Registration */}
      {showBulkRegistration && (
        <BulkActivityRegistration
          participants={participants}
          onComplete={loadData}
          onClose={() => setShowBulkRegistration(false)}
        />
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Søk etter navn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCabin} onValueChange={setFilterCabin}>
          <SelectTrigger className="w-full sm:w-40">
            <Home className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle hytter</SelectItem>
            {cabins.map((cabin) => (
              <SelectItem key={cabin.id} value={cabin.id}>
                {cabin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterArrival} onValueChange={setFilterArrival}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="arrived">Ankommet</SelectItem>
            <SelectItem value="not-arrived">Ikke ankommet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grouped by Cabin */}
      <div className="space-y-4">
        {cabinGroups.map(({ cabin, participants: cabinParticipants }) => {
          const cabinArrived = cabinParticipants.filter(p => p.has_arrived).length;
          const isExpanded = expandedCabins.has(cabin.id);
          
          return (
            <Collapsible 
              key={cabin.id} 
              open={isExpanded}
              onOpenChange={() => toggleCabinExpanded(cabin.id)}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <Home className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{cabin.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {cabinArrived}/{cabinParticipants.length} ankommet
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Group by room: høyre first, then venstre, then others */}
                    {(['høyre', 'venstre'] as const).map(roomSide => {
                      const roomParticipants = cabinParticipants
                        .filter(p => p.room === roomSide)
                        .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
                      
                      if (roomParticipants.length === 0) return null;
                      
                      return (
                        <div key={roomSide}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                roomSide === 'høyre' 
                                  ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30' 
                                  : 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30'
                              }`}
                            >
                              {roomSide.charAt(0).toUpperCase() + roomSide.slice(1)} ({roomParticipants.length})
                            </Badge>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {roomParticipants.map((participant) => {
                              const completedActivities = (participant.participant_activities || []).map(a => a.activity);
                              
                              return (
                                <div
                                  key={participant.id}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                    participant.has_arrived ? 'border-success/50 bg-success/5' : 'bg-card'
                                  }`}
                                  onClick={() => handleParticipantClick(participant.id)}
                                >
                                  <div className="flex items-start gap-3">
                                    <Avatar className="w-10 h-10 shrink-0">
                                      <AvatarImage src={participant.image_url || undefined} />
                                      <AvatarFallback className="bg-muted text-muted-foreground">
                                        <User className="w-4 h-4" />
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-foreground truncate text-sm">
                                          {participant.name}
                                        </p>
                                        {participant.has_arrived ? (
                                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                        ) : (
                                          <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        {participant.birth_date && (
                                          <Badge variant="outline" className="text-xs">
                                            {calculateAge(participant.birth_date)} år
                                          </Badge>
                                        )}
                                        <StyrkeproveBadges 
                                          completedActivities={completedActivities} 
                                          showCount 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Participants without room assignment */}
                    {(() => {
                      const noRoomParticipants = cabinParticipants
                        .filter(p => !p.room || (p.room !== 'høyre' && p.room !== 'venstre'))
                        .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
                      
                      if (noRoomParticipants.length === 0) return null;
                      
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              Uten rom ({noRoomParticipants.length})
                            </Badge>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {noRoomParticipants.map((participant) => {
                              const completedActivities = (participant.participant_activities || []).map(a => a.activity);
                              
                              return (
                                <div
                                  key={participant.id}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                    participant.has_arrived ? 'border-success/50 bg-success/5' : 'bg-card'
                                  }`}
                                  onClick={() => handleParticipantClick(participant.id)}
                                >
                                  <div className="flex items-start gap-3">
                                    <Avatar className="w-10 h-10 shrink-0">
                                      <AvatarImage src={participant.image_url || undefined} />
                                      <AvatarFallback className="bg-muted text-muted-foreground">
                                        <User className="w-4 h-4" />
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-foreground truncate text-sm">
                                          {participant.name}
                                        </p>
                                        {participant.has_arrived ? (
                                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                        ) : (
                                          <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        {participant.birth_date && (
                                          <Badge variant="outline" className="text-xs">
                                            {calculateAge(participant.birth_date)} år
                                          </Badge>
                                        )}
                                        <StyrkeproveBadges 
                                          completedActivities={completedActivities} 
                                          showCount 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {cabinGroups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ingen deltakere funnet</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery ? 'Prøv et annet søk' : 'Ingen deltakere registrert ennå'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Participant Detail Dialog */}
      <ParticipantDetailDialog
        participantId={selectedParticipantId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onParticipantUpdated={loadData}
      />
    </div>
  );
}
