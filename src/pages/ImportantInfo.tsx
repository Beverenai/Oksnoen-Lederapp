import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ArrowLeft, 
  Heart, 
  Home, 
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';

interface ParticipantWithHealthInfo {
  id: string;
  name: string;
  birth_date: string | null;
  room: string | null;
  image_url: string | null;
  cabin_id: string | null;
  cabin_name: string | null;
  healthInfo: string;
}

interface CabinGroup {
  cabinId: string;
  cabinName: string;
  participants: ParticipantWithHealthInfo[];
}

const calculateAge = (birthDate: string): number => {
  return differenceInYears(new Date(), new Date(birthDate));
};

export default function ImportantInfo() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const navigate = useNavigate();
  const [participantsWithInfo, setParticipantsWithInfo] = useState<ParticipantWithHealthInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCabins, setExpandedCabins] = useState<Set<string>>(new Set());
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch all participant_health_info with participant and cabin data
      const { data: healthInfoData, error } = await supabase
        .from('participant_health_info')
        .select(`
          info,
          participants (
            id,
            name,
            birth_date,
            room,
            image_url,
            cabin_id,
            cabins (name)
          )
        `);

      if (error) throw error;

      // Filter and transform the data
      const participants: ParticipantWithHealthInfo[] = (healthInfoData || [])
        .filter(h => h.info && h.info.trim() !== '' && h.participants)
        .map(h => ({
          id: h.participants!.id,
          name: h.participants!.name,
          birth_date: h.participants!.birth_date,
          room: h.participants!.room,
          image_url: h.participants!.image_url,
          cabin_id: h.participants!.cabin_id,
          cabin_name: (h.participants as any)?.cabins?.name || null,
          healthInfo: h.info
        }));

      setParticipantsWithInfo(participants);
      
      // Expand all cabins by default
      const cabinIds = new Set(participants.map(p => p.cabin_id || 'uncategorized'));
      setExpandedCabins(cabinIds);
    } catch (error) {
      console.error('Error loading health info:', error);
      showError('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };

  const cabinGroups = useMemo((): CabinGroup[] => {
    const groups: Map<string, CabinGroup> = new Map();
    
    participantsWithInfo.forEach(p => {
      const cabinId = p.cabin_id || 'uncategorized';
      const cabinName = p.cabin_name || 'Uten hytte';
      
      if (!groups.has(cabinId)) {
        groups.set(cabinId, {
          cabinId,
          cabinName,
          participants: []
        });
      }
      groups.get(cabinId)!.participants.push(p);
    });

    // Sort groups by cabin name, with "Uten hytte" last
    return Array.from(groups.values()).sort((a, b) => {
      if (a.cabinId === 'uncategorized') return 1;
      if (b.cabinId === 'uncategorized') return -1;
      return a.cabinName.localeCompare(b.cabinName, 'nb');
    });
  }, [participantsWithInfo]);

  const toggleCabinExpanded = (cabinId: string) => {
    const newExpanded = new Set(expandedCabins);
    if (newExpanded.has(cabinId)) {
      newExpanded.delete(cabinId);
    } else {
      newExpanded.add(cabinId);
    }
    setExpandedCabins(newExpanded);
  };

  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setIsDetailDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/passport')} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til passkontroll
      </Button>

      <div className="flex items-center gap-3">
        <Heart className="w-6 h-6 text-destructive" />
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Viktig Info
          </h1>
          <p className="text-muted-foreground mt-1">
            {participantsWithInfo.length} deltakere med viktig informasjon
          </p>
        </div>
      </div>

      {participantsWithInfo.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Ingen deltakere har registrert viktig informasjon.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cabinGroups.map(({ cabinId, cabinName, participants }) => {
            const isExpanded = expandedCabins.has(cabinId);
            
            return (
              <Collapsible 
                key={cabinId} 
                open={isExpanded}
                onOpenChange={() => toggleCabinExpanded(cabinId)}
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
                          <CardTitle className="text-lg">{cabinName}</CardTitle>
                        </div>
                        <Badge variant="outline">
                          {participants.length} {participants.length === 1 ? 'deltaker' : 'deltakere'}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-3">
                      {participants
                        .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
                        .map((participant) => (
                          <div
                            key={participant.id}
                            className="p-4 rounded-lg border bg-card cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-foreground">
                                    {participant.name}
                                  </p>
                                  {participant.birth_date && (
                                    <Badge variant="outline" className="text-xs">
                                      {calculateAge(participant.birth_date)} år
                                    </Badge>
                                  )}
                                  {participant.room && (
                                    <Badge variant="secondary" className="text-xs">
                                      {participant.room}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                                  {participant.healthInfo}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      <ParticipantDetailDialog
        participantId={selectedParticipantId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onParticipantUpdated={loadData}
      />
    </div>
  );
}
