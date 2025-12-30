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

// Team filter options with proper text colors
const TEAM_FILTERS = [
  { value: '1', label: 'Team 1', color: 'bg-red-500 text-white' },
  { value: '2', label: 'Team 2', color: 'bg-orange-500 text-white' },
  { value: '1f', label: 'Team 1F', color: 'bg-yellow-400 text-black' },
  { value: '2f', label: 'Team 2F', color: 'bg-blue-500 text-white' },
  { value: 'kjokken', label: 'Kjøkken', color: 'bg-purple-500 text-white' },
  { value: 'kordinator', label: 'Kordinator', color: 'bg-pink-500 text-white' },
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
  
  // Unread filter state
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

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

      // Merge content with leaders - filter out superadmin
      const merged = leaders
        .filter(leader => leader.name.toLowerCase() !== 'superadmin')
        .map(leader => {
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

  // Filter leaders by search, team, and unread status
  const filteredLeaders = leadersWithContent.filter(leader => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      leader.name.toLowerCase().includes(query) ||
      leader.content?.current_activity?.toLowerCase().includes(query) ||
      leader.content?.extra_activity?.toLowerCase().includes(query) ||
      leader.cabin?.toLowerCase().includes(query) ||
      leader.team?.toLowerCase().includes(query);
    
    const matchesTeam = !activeTeamFilter || leader.team?.toLowerCase().trim() === activeTeamFilter.toLowerCase();
    
    // Unread filter: exclude Admin, Nurse, and Kitchen from red ring check
    const isKitchen = leader.team?.toLowerCase() === 'kjokken' || leader.team?.toLowerCase() === 'kjøkken';
    const matchesUnread = !showUnreadOnly || (
      !leader.isAdmin && 
      !leader.isNurse && 
      !isKitchen &&
      !leader.content?.has_read
    );
    
    return matchesSearch && matchesTeam && matchesUnread;
  });

  // Sort: Admin -> Nurse -> Kordinator -> Team order -> Alphabetical
  const sortedLeaders = [...filteredLeaders].sort((a, b) => {
    // 1. Admin først (prioritet 0)
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    
    // 2. Nurse deretter (prioritet 1)
    if (a.isNurse && !b.isNurse) return -1;
    if (!a.isNurse && b.isNurse) return 1;
    
    // 3. Kordinator (prioritet 2)
    const aIsKord = a.team?.toLowerCase().trim() === 'kordinator';
    const bIsKord = b.team?.toLowerCase().trim() === 'kordinator';
    if (aIsKord && !bIsKord) return -1;
    if (!aIsKord && bIsKord) return 1;
    
    // 4. Team-rekkefølge (Team 1 → Team 2 → Team 1F → Team 2F → Kjøkken)
    const aOrder = getTeamSortOrder(a.team);
    const bOrder = getTeamSortOrder(b.team);
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // 5. Alfabetisk innenfor samme gruppe
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
          placeholder="Søk på navn, aktivitet, hytte, team..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Team Filter and Unread Filter */}
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
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTeamFilter(activeTeamFilter === filter.value ? null : filter.value);
                  setShowTeamFilters(false);
                }}
                className={`gap-1 ${filter.color} hover:opacity-80 border-transparent ${activeTeamFilter === filter.value ? 'ring-2 ring-offset-1 ring-foreground' : ''}`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        )}

        {/* Unread Filter */}
        <Button
          variant={showUnreadOnly ? "destructive" : "outline"}
          size="sm"
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className="gap-1.5"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Ikke lest
          {showUnreadOnly && <X className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-28">Navn</TableHead>
              <TableHead className="w-24">Team</TableHead>
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
                  <span className="font-medium">{getFirstName(leader.name)}</span>
                </TableCell>
                <TableCell>
                  {leader.team && (
                    <Badge variant="secondary" className={`text-xs w-20 justify-center ${getTeamStyles(leader.team)}`}>
                      {formatTeamDisplay(leader.team)}
                    </Badge>
                  )}
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

      {/* Mobile Table View */}
      <div className="md:hidden rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-2"></TableHead>
              <TableHead className="px-2">Navn</TableHead>
              <TableHead className="px-2">Team</TableHead>
              <TableHead className="px-2">Aktivitet</TableHead>
              <TableHead className="w-20 px-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaders.map((leader) => (
              <TableRow
                key={leader.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(leader)}
              >
                <TableCell className="px-2">
                  <Avatar className={`h-8 w-8 ${getAvatarBorderClass(leader)}`}>
                    <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} />
                    <AvatarFallback className="text-xs">
                      {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="px-2">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm">{getFirstName(leader.name)}</span>
                    {leader.content?.obs_message && (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  {leader.team && (
                    <Badge variant="secondary" className={`text-xs w-16 justify-center ${getTeamStyles(leader.team)}`}>
                      {formatTeamDisplay(leader.team)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-2 text-xs text-muted-foreground truncate max-w-[100px]">
                  {leader.content?.current_activity || '-'}
                </TableCell>
                <TableCell className="px-2">
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleSendNotification(e, leader)}
                      disabled={sendingNotification === leader.id}
                    >
                      <Bell className={`h-3.5 w-3.5 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleCall(e, leader.phone)}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
