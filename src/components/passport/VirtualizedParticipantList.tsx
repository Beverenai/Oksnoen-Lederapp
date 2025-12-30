import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CheckCircle2, 
  Circle,
  User,
  Home,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { StyrkeproveBadges } from '@/components/passport/StyrkeproveBadges';
import type { Tables } from '@/integrations/supabase/types';
import { hapticImpact } from '@/lib/capacitorHaptics';

type Cabin = Tables<'cabins'>;

interface ParticipantWithCabin {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  room: string | null;
  cabin_id: string | null;
  image_url: string | null;
  has_arrived: boolean | null;
  notes: string | null;
  activity_notes: string | null;
  times_attended: number | null;
  pass_written: boolean | null;
  pass_text: string | null;
  pass_suggestion: string | null;
  pass_written_by: string | null;
  pass_written_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  cabins: Cabin | null;
}

interface CabinGroup {
  cabin: Cabin;
  participants: ParticipantWithCabin[];
  leaders: { id: string; name: string }[];
}

type VirtualizedItem = 
  | { type: 'cabin-header'; cabin: Cabin; arrivedCount: number; totalCount: number; leaders: { id: string; name: string }[]; isExpanded: boolean }
  | { type: 'room-header'; roomName: string; participantCount: number; roomSide: 'høyre' | 'venstre' | 'none' }
  | { type: 'participant'; participant: ParticipantWithCabin; completedActivities: string[] };

interface VirtualizedParticipantListProps {
  cabinGroups: CabinGroup[];
  activitiesMap: Map<string, string[]>;
  expandedCabins: Set<string>;
  onToggleCabin: (cabinId: string) => void;
  onParticipantClick: (participantId: string) => void;
  onPrefetchParticipant: (participantId: string) => void;
}

const calculateAge = (birthDate: string): number => {
  return differenceInYears(new Date(), new Date(birthDate));
};

// Memoized participant card component
const ParticipantCard = memo(({ 
  participant, 
  completedActivities, 
  onClick, 
  onPrefetch 
}: { 
  participant: ParticipantWithCabin; 
  completedActivities: string[];
  onClick: () => void;
  onPrefetch: () => void;
}) => {
  const handleClick = () => {
    hapticImpact('light');
    onClick();
  };

  return (
    <div
      className={`mx-4 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        participant.has_arrived ? 'border-success/50 bg-success/5' : 'bg-card'
      }`}
      onClick={handleClick}
      onMouseEnter={onPrefetch}
      onTouchStart={onPrefetch}
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
});

ParticipantCard.displayName = 'ParticipantCard';

// Cabin header component
const CabinHeader = memo(({ 
  cabin, 
  arrivedCount, 
  totalCount, 
  leaders,
  isExpanded,
  onToggle 
}: { 
  cabin: Cabin;
  arrivedCount: number;
  totalCount: number;
  leaders: { id: string; name: string }[];
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const leaderFirstNames = leaders.map(l => l.name.split(' ')[0]);
  const displayNames = leaderFirstNames.slice(0, 2);
  const remainingCount = leaderFirstNames.length - 2;
  
  return (
    <Card className="mx-4 overflow-hidden">
      <CardHeader 
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Chevron - fixed width */}
          <div className="w-5 shrink-0 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          {/* Home icon - fixed width */}
          <div className="w-5 shrink-0 flex items-center justify-center">
            <Home className="w-5 h-5 text-primary" />
          </div>
          {/* Title - flexible, truncate */}
          <CardTitle className="text-base sm:text-lg truncate flex-1 min-w-0">{cabin.name}</CardTitle>
          {/* Leaders badges - hidden on mobile, limited width on tablet+ */}
          {displayNames.length > 0 && (
            <div className="hidden sm:flex gap-1 max-w-[100px] overflow-hidden shrink-0">
              {displayNames.map((name, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 whitespace-nowrap"
                >
                  {name}
                </Badge>
              ))}
              {remainingCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 whitespace-nowrap"
                >
                  +{remainingCount}
                </Badge>
              )}
            </div>
          )}
          {/* Status pill - responsive sizing, always visible */}
          <Badge 
            variant="outline"
            className="min-w-[70px] sm:min-w-[90px] h-7 justify-center text-xs shrink-0 whitespace-nowrap"
          >
            <span className="sm:hidden">{arrivedCount}/{totalCount}</span>
            <span className="hidden sm:inline">{arrivedCount}/{totalCount} ankommet</span>
          </Badge>
        </div>
      </CardHeader>
    </Card>
  );
});

CabinHeader.displayName = 'CabinHeader';

// Room header component
const RoomHeader = memo(({ roomName, participantCount, roomSide }: { 
  roomName: string; 
  participantCount: number;
  roomSide: 'høyre' | 'venstre' | 'none';
}) => (
  <div className="flex items-center gap-2 mx-4 pt-2">
    <Badge 
      variant="secondary" 
      className={`text-xs ${
        roomSide === 'høyre' 
          ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30' 
          : roomSide === 'venstre'
          ? 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30'
          : ''
      }`}
    >
      {roomName} ({participantCount})
    </Badge>
  </div>
));

RoomHeader.displayName = 'RoomHeader';

export function VirtualizedParticipantList({
  cabinGroups,
  activitiesMap,
  expandedCabins,
  onToggleCabin,
  onParticipantClick,
  onPrefetchParticipant,
}: VirtualizedParticipantListProps) {
  // Flatten the data structure for rendering
  const flattenedItems = useMemo((): VirtualizedItem[] => {
    const items: VirtualizedItem[] = [];
    
    cabinGroups.forEach(({ cabin, participants, leaders }) => {
      const cabinArrived = participants.filter(p => p.has_arrived).length;
      const isExpanded = expandedCabins.has(cabin.id);
      
      // Add cabin header
      items.push({ 
        type: 'cabin-header', 
        cabin, 
        arrivedCount: cabinArrived, 
        totalCount: participants.length,
        leaders,
        isExpanded
      });
      
      // Only add content if expanded
      if (isExpanded) {
        // Group participants by room
        const roomGroups: { side: 'høyre' | 'venstre' | 'none'; name: string; participants: ParticipantWithCabin[] }[] = [
          { side: 'høyre', name: 'Høyre', participants: participants.filter(p => p.room === 'høyre').sort((a, b) => a.name.localeCompare(b.name, 'nb')) },
          { side: 'venstre', name: 'Venstre', participants: participants.filter(p => p.room === 'venstre').sort((a, b) => a.name.localeCompare(b.name, 'nb')) },
          { side: 'none', name: 'Uten rom', participants: participants.filter(p => !p.room || (p.room !== 'høyre' && p.room !== 'venstre')).sort((a, b) => a.name.localeCompare(b.name, 'nb')) },
        ];
        
        roomGroups.forEach(({ side, name, participants: roomParticipants }) => {
          if (roomParticipants.length > 0) {
            items.push({ type: 'room-header', roomName: name, participantCount: roomParticipants.length, roomSide: side });
            
            roomParticipants.forEach(participant => {
              const completedActivities = activitiesMap.get(participant.id) || [];
              items.push({ type: 'participant', participant, completedActivities });
            });
          }
        });
      }
    });
    
    return items;
  }, [cabinGroups, expandedCabins, activitiesMap]);

  if (flattenedItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Ingen deltakere funnet</h3>
          <p className="text-muted-foreground mt-1">
            Prøv et annet søk eller fjern filteret
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render items directly without virtualization for single-scroll behavior
  return (
    <div className="space-y-2">
      {flattenedItems.map((item, index) => {
        if (item.type === 'cabin-header') {
          return (
            <CabinHeader
              key={`cabin-${item.cabin.id}`}
              cabin={item.cabin}
              arrivedCount={item.arrivedCount}
              totalCount={item.totalCount}
              leaders={item.leaders}
              isExpanded={item.isExpanded}
              onToggle={() => onToggleCabin(item.cabin.id)}
            />
          );
        }
        
        if (item.type === 'room-header') {
          return (
            <RoomHeader 
              key={`room-${item.roomName}-${index}`}
              roomName={item.roomName} 
              participantCount={item.participantCount}
              roomSide={item.roomSide}
            />
          );
        }
        
        if (item.type === 'participant') {
          const completedActivities = item.completedActivities;
          return (
            <ParticipantCard
              key={`participant-${item.participant.id}`}
              participant={item.participant}
              completedActivities={completedActivities}
              onClick={() => onParticipantClick(item.participant.id)}
              onPrefetch={() => onPrefetchParticipant(item.participant.id)}
            />
          );
        }
        
        return null;
      })}
    </div>
  );
}
