import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  CheckCircle2, 
  Circle,
  User,
  Home,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Users,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { StyrkeproveBadges } from '@/components/passport/StyrkeproveBadges';
import { BulkActivityRegistration } from '@/components/passport/BulkActivityRegistration';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
import { useAuth } from '@/contexts/AuthContext';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;
type ParticipantActivity = Tables<'participant_activities'>;
type Leader = Tables<'leaders'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
  participant_activities?: ParticipantActivity[];
}

interface LeaderCabinLink {
  cabin_id: string;
  leaders: { id: string; name: string }[];
}

interface CabinGroup {
  cabin: Cabin;
  participants: ParticipantWithCabin[];
  leaders: { id: string; name: string }[];
}

const calculateAge = (birthDate: string): number => {
  return differenceInYears(new Date(), new Date(birthDate));
};

export default function Passport() {
  const navigate = useNavigate();
  const { leader } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const cabinFilterFromUrl = searchParams.get('cabin');
  
  const [participants, setParticipants] = useState<ParticipantWithCabin[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [leaderCabins, setLeaderCabins] = useState<Map<string, { id: string; name: string }[]>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [myCabinIds, setMyCabinIds] = useState<string[]>([]);
  const [myCabinsFilter, setMyCabinsFilter] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [expandedCabins, setExpandedCabins] = useState<Set<string>>(new Set());
  const [showBulkRegistration, setShowBulkRegistration] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);

  useEffect(() => {
    loadData();
  }, [leader?.id]);

  const clearCabinFilter = () => {
    setMyCabinsFilter(false);
    setSearchParams({});
  };

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [participantsRes, cabinsRes, configRes, leaderCabinsRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, cabins(*), participant_activities(*)')
          .order('name'),
        supabase.from('cabins').select('*').order('name', { ascending: true }),
        supabase.from('app_config').select('value').eq('key', 'checkout_enabled').maybeSingle(),
        supabase
          .from('leader_cabins')
          .select('cabin_id, leaders(id, name)')
      ]);

      // Fetch current leader's cabins if logged in (separate query to avoid type issues)
      let myCabinsData: string[] = [];
      if (leader?.id) {
        const { data: myCabinsRes } = await supabase
          .from('leader_cabins')
          .select('cabin_id')
          .eq('leader_id', leader.id);
        myCabinsData = (myCabinsRes || []).map(c => c.cabin_id);
      }
      setMyCabinIds(myCabinsData);

      // Build leader-cabin map
      const leaderMap = new Map<string, { id: string; name: string }[]>();
      (leaderCabinsRes.data || []).forEach((lc: any) => {
        if (lc.cabin_id && lc.leaders) {
          const existing = leaderMap.get(lc.cabin_id) || [];
          existing.push({ id: lc.leaders.id, name: lc.leaders.name });
          leaderMap.set(lc.cabin_id, existing);
        }
      });
      setLeaderCabins(leaderMap);

      setParticipants(participantsRes.data || []);
      setCabins(cabinsRes.data || []);
      setCheckoutEnabled(configRes.data?.value === 'true');
      
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
      
      // Filter by leader's cabins if "Min hytte" is active
      const matchesCabin = myCabinsFilter 
        ? myCabinIds.includes(p.cabin_id || '') 
        : true;
      
      return matchesSearch && matchesCabin;
    });
  }, [participants, searchQuery, myCabinsFilter, myCabinIds]);

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
        groups.push({ 
          cabin, 
          participants: cabinParticipants,
          leaders: leaderCabins.get(cabin.id) || []
        });
      }
    });

    if (uncategorized.length > 0) {
      groups.push({
        cabin: { id: 'uncategorized', name: 'Uten hytte', sort_order: 999, created_at: null },
        participants: uncategorized,
        leaders: []
      });
    }

    return groups;
  }, [filteredParticipants, cabins, leaderCabins]);

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

  // Get the filtered cabin names for display
  const myCabinNames = myCabinIds
    .map(id => cabins.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button when filtered by cabin */}
      {(cabinFilterFromUrl || myCabinsFilter) && (
        <Button variant="ghost" onClick={clearCabinFilter} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tilbake til alle hytter
        </Button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            {myCabinsFilter && myCabinNames ? myCabinNames : 'Passkontroll'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {arrivedCount} av {participants.length} deltakere har ankommet
          </p>
        </div>

        {/* Action buttons in a row */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showBulkRegistration ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowBulkRegistration(!showBulkRegistration)}
          >
            <Users className="w-4 h-4 mr-1.5" />
            {showBulkRegistration ? 'Skjul' : 'Aktivitet'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/important-info')}
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Viktig Info
          </Button>
          
          {/* My cabin filter button - only show if leader has assigned cabins */}
          {myCabinIds.length > 0 && (
            <Button
              variant={myCabinsFilter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMyCabinsFilter(!myCabinsFilter)}
              className="gap-1.5"
            >
              <Home className="w-4 h-4" />
              {myCabinsFilter ? 'Alle hytter' : 'Min hytte'}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Activity Registration */}
      {showBulkRegistration && (
        <BulkActivityRegistration
          participants={participants}
          onComplete={loadData}
          onClose={() => setShowBulkRegistration(false)}
        />
      )}

      {/* Search Field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Søk etter navn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Checkout button - prominent placement when enabled */}
      {checkoutEnabled && (
        <Button
          variant="default"
          size="lg"
          onClick={() => navigate('/checkout')}
          className="w-full gap-2 text-lg py-6"
        >
          <Sparkles className="w-5 h-5" />
          Utsjekk
        </Button>
      )}

      {/* Grouped by Cabin */}
      <div className="space-y-4">
        {cabinGroups.map(({ cabin, participants: cabinParticipants, leaders }) => {
          const cabinArrived = cabinParticipants.filter(p => p.has_arrived).length;
          const isExpanded = expandedCabins.has(cabin.id);
          
          // Get first names of leaders
          const leaderFirstNames = leaders.map(l => l.name.split(' ')[0]);
          
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
                        {/* Leader badges */}
                        {leaderFirstNames.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {leaderFirstNames.map((name, idx) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
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
                                      <AvatarImage src={participant.image_url || undefined} loading="lazy" />
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
                                          compact
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
                                      <AvatarImage src={participant.image_url || undefined} loading="lazy" />
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
        onParticipantUpdated={() => loadData(false)}
      />
    </div>
  );
}
