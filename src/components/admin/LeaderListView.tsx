import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Bell, Phone, Search, AlertTriangle, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { LeaderContentSheet } from './LeaderContentSheet';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
}

interface HomeScreenConfigItem {
  id: string;
  element_key: string;
  label: string;
  title: string | null;
  icon: string | null;
  is_visible: boolean | null;
  sort_order: number | null;
}

interface LeaderListViewProps {
  leaders: Leader[];
  homeConfig: HomeScreenConfigItem[];
  onLeaderUpdated?: () => void;
}

// Helper functions
const getFirstName = (fullName: string): string => {
  return fullName.split(' ')[0];
};

// Format team display name
const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  if (teamLower === 'kjokken') return 'Kjøkken';
  return team;
};

// Team sorting order (same as LeaderDashboard)
const getTeamSortOrder = (team: string | null): number => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case 'kordinator': return 1;
    case '1':
    case 'team 1': return 2;
    case '2':
    case 'team 2': return 3;
    case '1f':
    case 'team 1f': return 4;
    case '2f':
    case 'team 2f': return 5;
    case 'kjokken': return 6;
    default: return 7;
  }
};

// Team color styles
const getTeamStyles = (team: string | null) => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case '1':
    case 'team 1':
      return 'bg-red-500 text-white';
    case '2':
    case 'team 2':
      return 'bg-orange-500 text-white';
    case '1f':
    case 'team 1f':
      return 'bg-yellow-400 text-black';
    case '2f':
    case 'team 2f':
      return 'bg-blue-500 text-white';
    case 'kjokken':
      return 'bg-purple-500 text-white';
    case 'kordinator':
      return 'bg-pink-500 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// Team filter options
const TEAM_FILTERS = [
  { value: '1', label: 'Team 1', color: 'bg-red-500' },
  { value: '2', label: 'Team 2', color: 'bg-orange-500' },
  { value: '1f', label: 'Team 1F', color: 'bg-yellow-400' },
  { value: '2f', label: 'Team 2F', color: 'bg-blue-500' },
  { value: 'kjokken', label: 'Kjøkken', color: 'bg-purple-500' },
  { value: 'kordinator', label: 'Kordinator', color: 'bg-pink-500' },
];

export function LeaderListView({ leaders, homeConfig, onLeaderUpdated }: LeaderListViewProps) {
  const { leader: currentLeader } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [leadersWithContent, setLeadersWithContent] = useState<LeaderWithContent[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [nurseIds, setNurseIds] = useState<string[]>([]);
  
  // Team filter state
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [showTeamFilters, setShowTeamFilters] = useState(false);

  // Fetch leader content and roles
  useEffect(() => {
    const fetchContent = async () => {
      // Fetch leader content
      const { data: contentData } = await supabase
        .from('leader_content')
        .select('*');

      // Fetch admin and nurse roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('leader_id, role');

      const admins = rolesData?.filter(r => r.role === 'admin').map(r => r.leader_id) || [];
      const nurses = rolesData?.filter(r => r.role === 'nurse').map(r => r.leader_id) || [];
      setAdminIds(admins);
      setNurseIds(nurses);

      // Merge content with leaders
      const merged = leaders.map(leader => {
        const content = contentData?.find(c => c.leader_id === leader.id);
        return {
          ...leader,
          content,
          isAdmin: admins.includes(leader.id),
          isNurse: nurses.includes(leader.id),
        };
      });

      setLeadersWithContent(merged);
    };

    fetchContent();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('leader-list-content')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leader_content' },
        () => fetchContent()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leaders]);

  // Filter leaders by search and team
  const filteredLeaders = leadersWithContent.filter(leader => {
    const matchesSearch = leader.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !activeTeamFilter || leader.team?.toLowerCase().trim() === activeTeamFilter.toLowerCase();
    return matchesSearch && matchesTeam;
  });

  // Sort: by team order, then by name
  const sortedLeaders = [...filteredLeaders].sort((a, b) => {
    // First by team order
    const aTeamOrder = getTeamSortOrder(a.team);
    const bTeamOrder = getTeamSortOrder(b.team);
    if (aTeamOrder !== bTeamOrder) return aTeamOrder - bTeamOrder;
    
    // Then by name
    return a.name.localeCompare(b.name, 'nb');
  });

  // Send notification to single leader
  const handleSendNotification = async (e: React.MouseEvent, leader: LeaderWithContent) => {
    e.stopPropagation();
    
    if (!currentLeader) {
      toast.error('Du må være logget inn');
      return;
    }

    setSendingNotification(leader.id);

    try {
      const { error } = await supabase.functions.invoke('push-send', {
        body: {
          title: 'Melding fra admin',
          message: 'Sjekk appen for oppdateringer',
          url: '/',
          target_leader_ids: [leader.id],
          sender_leader_id: currentLeader.id,
        },
      });

      if (error) throw error;
      toast.success(`Varsling sendt til ${getFirstName(leader.name)}`);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Kunne ikke sende varsling');
    } finally {
      setSendingNotification(null);
    }
  };

  // Handle call
  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  // Open leader detail
  const handleRowClick = (leader: LeaderWithContent) => {
    setSelectedLeader(leader);
    setSheetOpen(true);
  };

  // Get avatar border class based on status
  const getAvatarBorderClass = (leader: LeaderWithContent) => {
    const isKitchen = leader.team?.toLowerCase() === 'kjokken' || leader.team?.toLowerCase() === 'kjøkken';
    const isFri = leader.content?.current_activity?.toLowerCase().includes('fri');
    
    // Admin/Nurse = always green
    if (leader.isAdmin || leader.isNurse) return 'ring-2 ring-green-500';
    // Kitchen = always purple
    if (isKitchen) return 'ring-2 ring-purple-500';
    // "Fri" activity = blue
    if (isFri) return 'ring-2 ring-blue-500';
    // Has read = green
    if (leader.content?.has_read) return 'ring-2 ring-green-500';
    // Has not read = red
    return 'ring-2 ring-red-500';
  };

  // Truncate text
  const truncate = (text: string | null | undefined, maxLength: number) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Get active filter label
  const getActiveFilterLabel = () => {
    if (!activeTeamFilter) return 'Alle';
    const filter = TEAM_FILTERS.find(f => f.value === activeTeamFilter);
    return filter?.label || 'Alle';
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Søk etter leder..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Team Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activeTeamFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTeamFilters(!showTeamFilters)}
          className="gap-1"
        >
          {getActiveFilterLabel()}
          {activeTeamFilter ? (
            <X 
              className="h-3 w-3 ml-1" 
              onClick={(e) => {
                e.stopPropagation();
                setActiveTeamFilter(null);
              }}
            />
          ) : (
            <ChevronDown className={`h-3 w-3 transition-transform ${showTeamFilters ? 'rotate-180' : ''}`} />
          )}
        </Button>

        {showTeamFilters && (
          <div className="flex flex-wrap gap-1">
            {TEAM_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={activeTeamFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTeamFilter(activeTeamFilter === filter.value ? null : filter.value);
                  setShowTeamFilters(false);
                }}
                className={`gap-1 ${activeTeamFilter === filter.value ? filter.color : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${filter.color}`} />
                {filter.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Navn</TableHead>
              <TableHead>Aktivitet</TableHead>
              <TableHead>Ekstra aktivitet</TableHead>
              <TableHead>Notater</TableHead>
              <TableHead>OBS</TableHead>
              <TableHead className="w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaders.map((leader) => (
              <TableRow
                key={leader.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(leader)}
              >
                <TableCell>
                  <Avatar className={`h-8 w-8 ${getAvatarBorderClass(leader)}`}>
                    <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} />
                    <AvatarFallback className="text-xs">
                      {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{getFirstName(leader.name)}</span>
                    {leader.team && (
                      <Badge variant="secondary" className={`text-xs w-20 justify-center ${getTeamStyles(leader.team)}`}>
                        {formatTeamDisplay(leader.team)}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {leader.content?.current_activity || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {leader.content?.extra_activity || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[150px]">
                  {truncate(leader.content?.personal_notes, 30)}
                </TableCell>
                <TableCell>
                  {leader.content?.obs_message ? (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-xs">{truncate(leader.content.obs_message, 20)}</span>
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleSendNotification(e, leader)}
                      disabled={sendingNotification === leader.id}
                    >
                      <Bell className={`h-4 w-4 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleCall(e, leader.phone)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden space-y-2">
        {sortedLeaders.map((leader) => (
          <div
            key={leader.id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleRowClick(leader)}
          >
            <Avatar className={`h-10 w-10 ${getAvatarBorderClass(leader)}`}>
              <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} />
              <AvatarFallback>
                {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{getFirstName(leader.name)}</span>
                {leader.team && (
                  <Badge variant="secondary" className={`text-xs w-16 justify-center shrink-0 ${getTeamStyles(leader.team)}`}>
                    {formatTeamDisplay(leader.team)}
                  </Badge>
                )}
                {leader.content?.obs_message && (
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {leader.content?.current_activity || 'Ingen aktivitet'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => handleSendNotification(e, leader)}
                disabled={sendingNotification === leader.id}
              >
                <Bell className={`h-4 w-4 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => handleCall(e, leader.phone)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {sortedLeaders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Ingen ledere funnet
        </div>
      )}

      {/* Leader Content Sheet */}
      {selectedLeader && (
        <LeaderContentSheet
          leader={selectedLeader}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          homeConfig={homeConfig}
          onSaved={() => {
            onLeaderUpdated?.();
          }}
        />
      )}
    </div>
  );
}
