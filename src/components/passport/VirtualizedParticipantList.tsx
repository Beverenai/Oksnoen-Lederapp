import { memo, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { List, ListImperativeAPI } from 'react-window';
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

const CABIN_HEADER_HEIGHT = 72;
const ROOM_HEADER_HEIGHT = 40;
const PARTICIPANT_ROW_HEIGHT = 88;

interface VirtualizedParticipantListProps {
  cabinGroups: CabinGroup[];
  activitiesMap: Map<string, string[]>;
  expandedCabins: Set<string>;
  onToggleCabin: (cabinId: string) => void;
  onParticipantClick: (participantId: string) => void;
  onPrefetchParticipant: (participantId: string) => void;
}

// Row props interface (what we pass via rowProps)
interface RowData {
  items: VirtualizedItem[];
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
}) => (
  <div
    className={`mx-4 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
      participant.has_arrived ? 'border-success/50 bg-success/5' : 'bg-card'
    }`}
    onClick={onClick}
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
));

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
  
  return (
    <Card className="mx-4 overflow-hidden">
      <CardHeader 
        className="py-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
            <Home className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">{cabin.name}</CardTitle>
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
              {arrivedCount}/{totalCount} ankommet
            </Badge>
          </div>
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

// Row component for the list - must return ReactElement
function Row({ 
  index, 
  style,
  items,
  onToggleCabin,
  onParticipantClick,
  onPrefetchParticipant,
}: { 
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number; 
  style: React.CSSProperties;
  items: VirtualizedItem[];
  onToggleCabin: (cabinId: string) => void;
  onParticipantClick: (participantId: string) => void;
  onPrefetchParticipant: (participantId: string) => void;
}) {
  const item = items[index];
  
  if (item.type === 'cabin-header') {
    return (
      <div style={style}>
        <CabinHeader
          cabin={item.cabin}
          arrivedCount={item.arrivedCount}
          totalCount={item.totalCount}
          leaders={item.leaders}
          isExpanded={item.isExpanded}
          onToggle={() => onToggleCabin(item.cabin.id)}
        />
      </div>
    );
  }
  
  if (item.type === 'room-header') {
    return (
      <div style={style}>
        <RoomHeader 
          roomName={item.roomName} 
          participantCount={item.participantCount}
          roomSide={item.roomSide}
        />
      </div>
    );
  }
  
  if (item.type === 'participant') {
    return (
      <div style={style}>
        <ParticipantCard
          participant={item.participant}
          completedActivities={item.completedActivities}
          onClick={() => onParticipantClick(item.participant.id)}
          onPrefetch={() => onPrefetchParticipant(item.participant.id)}
        />
      </div>
    );
  }
  
  return <div style={style} />;
}

export function VirtualizedParticipantList({
  cabinGroups,
  activitiesMap,
  expandedCabins,
  onToggleCabin,
  onParticipantClick,
  onPrefetchParticipant,
}: VirtualizedParticipantListProps) {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);

  // Flatten the data structure for virtualization
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

  // Get item size based on type (function for variable row heights)
  const getItemSize = useCallback((index: number): number => {
    const item = flattenedItems[index];
    switch (item.type) {
      case 'cabin-header': return CABIN_HEADER_HEIGHT;
      case 'room-header': return ROOM_HEADER_HEIGHT;
      case 'participant': return PARTICIPANT_ROW_HEIGHT;
      default: return PARTICIPANT_ROW_HEIGHT;
    }
  }, [flattenedItems]);

  // Row props to pass to the row component (without index, style, ariaAttributes)
  const rowProps = useMemo((): RowData => ({
    items: flattenedItems,
    onToggleCabin,
    onParticipantClick,
    onPrefetchParticipant,
  }), [flattenedItems, onToggleCabin, onParticipantClick, onPrefetchParticipant]);

  // Calculate list height (use available viewport height)
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Leave some space for the bottom navigation
        setListHeight(window.innerHeight - rect.top - 80);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

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

  return (
    <div ref={containerRef} className="space-y-2">
      <List<RowData>
        listRef={listRef}
        rowCount={flattenedItems.length}
        rowHeight={getItemSize}
        rowComponent={Row}
        rowProps={rowProps}
        defaultHeight={listHeight}
        style={{ height: listHeight }}
        className="scrollbar-thin"
        overscanCount={5}
      />
    </div>
  );
}
