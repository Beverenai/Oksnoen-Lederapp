import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  CheckCircle2, 
  Circle,
  User,
  Home,
  ChevronDown,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { StyrkeproveBadges } from '@/components/passport/StyrkeproveBadges';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;
type ParticipantActivity = Tables<'participant_activities'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
  participant_activities?: ParticipantActivity[];
}

interface LeaderCabin extends Cabin {
  participants: ParticipantWithCabin[];
}

const calculateAge = (birthDate: string): number => {
  return differenceInYears(new Date(), new Date(birthDate));
};

export default function MyCabins() {
  const { leader } = useAuth();
  const navigate = useNavigate();
  const [cabins, setCabins] = useState<LeaderCabin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithCabin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [expandedCabins, setExpandedCabins] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [leader]);

  const loadData = async () => {
    if (!leader) return;
    
    setIsLoading(true);
    try {
      // Get leader's cabin assignments
      const { data: leaderCabins } = await supabase
        .from('leader_cabins')
        .select('cabin_id, cabins(*)')
        .eq('leader_id', leader.id);

      if (!leaderCabins || leaderCabins.length === 0) {
        setCabins([]);
        setIsLoading(false);
        return;
      }

      const cabinIds = leaderCabins.map(lc => lc.cabin_id);
      
      // Get participants for these cabins
      const { data: participants } = await supabase
        .from('participants')
        .select('*, cabins(*), participant_activities(*)')
        .in('cabin_id', cabinIds)
        .order('name');

      // Build cabin data with participants
      const cabinData: LeaderCabin[] = leaderCabins
        .map(lc => {
          const cabin = lc.cabins as Cabin;
          if (!cabin) return null;
          
          const cabinParticipants = (participants || []).filter(p => p.cabin_id === cabin.id);
          return {
            ...cabin,
            participants: cabinParticipants
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.name.localeCompare(b!.name, 'nb')) as LeaderCabin[];

      setCabins(cabinData);
      setExpandedCabins(new Set(cabinData.map(c => c.id)));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCabins = useMemo(() => {
    if (!searchQuery) return cabins;
    
    const query = searchQuery.toLowerCase();
    return cabins.map(cabin => ({
      ...cabin,
      participants: cabin.participants.filter(p => 
        p.name.toLowerCase().includes(query)
      )
    })).filter(cabin => cabin.participants.length > 0);
  }, [cabins, searchQuery]);

  const toggleCabinExpanded = (cabinId: string) => {
    const newExpanded = new Set(expandedCabins);
    if (newExpanded.has(cabinId)) {
      newExpanded.delete(cabinId);
    } else {
      newExpanded.add(cabinId);
    }
    setExpandedCabins(newExpanded);
  };

  const toggleArrival = async (participant: ParticipantWithCabin) => {
    try {
      await supabase
        .from('participants')
        .update({ has_arrived: !participant.has_arrived })
        .eq('id', participant.id);
      
      loadData();
      toast.success(participant.has_arrived ? 'Ankomst fjernet' : 'Markert som ankommet!');
    } catch (error) {
      toast.error('Kunne ikke oppdatere status');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12" />
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (cabins.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tilbake
        </Button>
        <div className="text-center py-12">
          <Home className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Ingen hytter tildelt</h2>
          <p className="text-muted-foreground">Du har ikke blitt tildelt noen hytter ennå.</p>
        </div>
      </div>
    );
  }

  const totalParticipants = cabins.reduce((sum, c) => sum + c.participants.length, 0);
  const arrivedCount = cabins.reduce((sum, c) => sum + c.participants.filter(p => p.has_arrived).length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake
      </Button>

      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          {cabins.length === 1 ? cabins[0].name : 'Dine hytter'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {arrivedCount} av {totalParticipants} deltakere har ankommet
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Søk etter navn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Cabins */}
      <div className="space-y-4">
        {filteredCabins.map((cabin) => {
          const cabinArrived = cabin.participants.filter(p => p.has_arrived).length;
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
                      <Badge variant="outline">
                        {cabinArrived}/{cabin.participants.length} ankommet
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Group by room: høyre first, then venstre, then others */}
                    {(['høyre', 'venstre'] as const).map(roomSide => {
                      const roomParticipants = cabin.participants
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
                                  onClick={() => {
                                    setSelectedParticipant(participant);
                                    setIsDetailDialogOpen(true);
                                  }}
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

                    {/* Participants without room */}
                    {(() => {
                      const otherParticipants = cabin.participants
                        .filter(p => !p.room || (p.room !== 'høyre' && p.room !== 'venstre'))
                        .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
                      
                      if (otherParticipants.length === 0) return null;
                      
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              Uten rom ({otherParticipants.length})
                            </Badge>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {otherParticipants.map((participant) => {
                              const completedActivities = (participant.participant_activities || []).map(a => a.activity);
                              
                              return (
                                <div
                                  key={participant.id}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                    participant.has_arrived ? 'border-success/50 bg-success/5' : 'bg-card'
                                  }`}
                                  onClick={() => {
                                    setSelectedParticipant(participant);
                                    setIsDetailDialogOpen(true);
                                  }}
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

      {/* Participant Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedParticipant?.name}</DialogTitle>
          </DialogHeader>
          {selectedParticipant && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={selectedParticipant.image_url || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedParticipant.name}</p>
                  {selectedParticipant.birth_date && (
                    <p className="text-sm text-muted-foreground">
                      {calculateAge(selectedParticipant.birth_date)} år
                    </p>
                  )}
                  {selectedParticipant.room && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs mt-1 ${
                        selectedParticipant.room === 'høyre' 
                          ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                          : selectedParticipant.room === 'venstre'
                            ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                            : ''
                      }`}
                    >
                      {selectedParticipant.room.charAt(0).toUpperCase() + selectedParticipant.room.slice(1)}
                    </Badge>
                  )}
                </div>
              </div>

              <Button
                onClick={() => toggleArrival(selectedParticipant)}
                variant={selectedParticipant.has_arrived ? 'outline' : 'default'}
                className="w-full"
              >
                {selectedParticipant.has_arrived ? (
                  <>
                    <Circle className="w-4 h-4 mr-2" />
                    Fjern ankomst
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Marker som ankommet
                  </>
                )}
              </Button>

              {selectedParticipant.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Notater</p>
                  <p className="text-sm text-foreground">{selectedParticipant.notes}</p>
                </div>
              )}

              <StyrkeproveBadges 
                completedActivities={(selectedParticipant.participant_activities || []).map(a => a.activity)} 
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
