import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertTriangle, Edit, MapPin, FileText, ChevronDown, X } from 'lucide-react';
import { LeaderContentSheet } from './LeaderContentSheet';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

type HomeScreenConfigItem = {
  id: string;
  element_key: string;
  label: string;
  title: string | null;
  icon: string | null;
  is_visible: boolean | null;
  sort_order: number | null;
};

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
}

// Team color mapping - supports both short (1, 2f) and long (Team 1, Team 2F) formats
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case '1':
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case '2':
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case '1f':
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case '2f':
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
      return 'bg-purple-500 text-white border-purple-500';
    case 'sjef':
      return 'bg-slate-600 text-white border-slate-600';
    case 'kordinator':
      return 'bg-pink-500 text-white border-pink-500';
    case 'nurse':
      return 'bg-rose-600 text-white border-rose-600';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Format team display: "1" -> "Team 1", "2f" -> "Team 2F", others unchanged
const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  return team;
};

// Compact team display for mobile: "1", "2F", "KJ", "K" etc.
const formatTeamDisplayMobile = (team: string | null, isAdmin?: boolean, isNurse?: boolean): string => {
  if (isAdmin) return 'A';
  if (isNurse) return 'N';
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (teamLower === '1' || teamLower === 'team 1') return '1';
  if (teamLower === '2' || teamLower === 'team 2') return '2';
  if (teamLower === '1f' || teamLower === 'team 1f') return '1F';
  if (teamLower === '2f' || teamLower === 'team 2f') return '2F';
  if (teamLower === 'kordinator') return 'K';
  if (teamLower === 'kjøkken') return 'KJ';
  return team.substring(0, 2).toUpperCase();
};

const getFirstName = (fullName: string) => fullName.split(' ')[0];

// Team filters for filtering UI with proper text colors
const TEAM_FILTERS = [
  { value: '1', label: 'Team 1', color: 'bg-red-500 text-white' },
  { value: '2', label: 'Team 2', color: 'bg-orange-500 text-white' },
  { value: '1f', label: 'Team 1F', color: 'bg-yellow-400 text-black' },
  { value: '2f', label: 'Team 2F', color: 'bg-blue-500 text-white' },
  { value: 'kjøkken', label: 'Kjøkken', color: 'bg-purple-500 text-white' },
  { value: 'kordinator', label: 'Kordinator', color: 'bg-pink-500 text-white' },
];

interface LeaderDashboardProps {
  leaders: Leader[];
  homeConfig: HomeScreenConfigItem[];
  onLeaderUpdated: () => void;
  onScheduleAutoExport: () => void;
}

export function LeaderDashboard({ leaders, homeConfig, onLeaderUpdated, onScheduleAutoExport }: LeaderDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [leadersWithContent, setLeadersWithContent] = useState<LeaderWithContent[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [showTeamFilters, setShowTeamFilters] = useState(false);
  const [nurseIds, setNurseIds] = useState<Set<string>>(new Set());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Memoize activeLeaders to prevent new array reference on every render - filter out superadmin
  const activeLeaders = useMemo(() => 
    leaders.filter(l => 
      l.is_active !== false && 
      l.phone !== '12345678' && 
      l.name.toLowerCase() !== 'superadmin'
    ),
    [leaders]
  );

  // Use ref to access activeLeaders inside callback without adding it as dependency
  const activeLeadersRef = useRef(activeLeaders);
  activeLeadersRef.current = activeLeaders;

  // Fetch all leader content and roles - stable callback with no dependencies
  const fetchContent = useCallback(async () => {
    setLoading(true);
    const { data: contentData } = await supabase
      .from('leader_content')
      .select('*');

    // Fetch admin and nurse roles separately for sorting and green border
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('leader_id, role')
      .in('role', ['admin', 'nurse']);

    const adminSet = new Set(rolesData?.filter(r => r.role === 'admin').map(r => r.leader_id) || []);
    const nurseSet = new Set(rolesData?.filter(r => r.role === 'nurse').map(r => r.leader_id) || []);
    setAdminIds(adminSet);
    setNurseIds(nurseSet);

    const leadersMap = activeLeadersRef.current.map(leader => ({
      ...leader,
      content: contentData?.find(c => c.leader_id === leader.id) || null
    }));

    setLeadersWithContent(leadersMap);
    setLoading(false);
  }, []);

  // Initial fetch when leaders change
  useEffect(() => {
    if (leaders.length > 0) {
      fetchContent();
    }
  }, [leaders, fetchContent]);

  // Realtime subscription - setup once
  useEffect(() => {
    const channel = supabase
      .channel('leader-content-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leader_content'
        },
        () => {
          fetchContent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContent]);

  // Filter leaders based on search, team filter, and unread status
  const filteredLeaders = leadersWithContent.filter(leader => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = leader.name.toLowerCase().includes(query) ||
      leader.ministerpost?.toLowerCase().includes(query) ||
      leader.team?.toLowerCase().includes(query) ||
      leader.cabin?.toLowerCase().includes(query) ||
      leader.content?.current_activity?.toLowerCase().includes(query) ||
      leader.content?.extra_activity?.toLowerCase().includes(query);
    
    const matchesTeam = !activeTeamFilter || 
      leader.team?.toLowerCase().trim() === activeTeamFilter.toLowerCase();
    
    // Unread filter: exclude Admin, Nurse, Kitchen, and "Fri" activity from red ring check
    const isKitchen = leader.team?.toLowerCase() === 'kjøkken';
    const isAdminOrNurse = adminIds.has(leader.id) || nurseIds.has(leader.id);
    const hasFriActivity = 
      leader.content?.current_activity?.toLowerCase().includes('fri') ||
      leader.content?.extra_activity?.toLowerCase().includes('fri');
    const matchesUnread = !showUnreadOnly || (
      !isAdminOrNurse && 
      !isKitchen &&
      !hasFriActivity &&
      !leader.content?.has_read
    );
    
    return matchesSearch && matchesTeam && matchesUnread;
  });

  const getActiveFilterLabel = () => {
    if (!activeTeamFilter) return 'Alle';
    const filter = TEAM_FILTERS.find(f => f.value === activeTeamFilter);
    return filter?.label || 'Alle';
  };

  // Sort leaders: Admin first, then Nurse, then Kordinator, then by team order
  const sortedLeaders = useMemo(() => {
    const getTeamSortOrder = (team: string | null): number => {
      const teamLower = team?.toLowerCase().trim();
      switch (teamLower) {
        case 'kordinator':
          return 1;
        case '1':
        case 'team 1':
          return 2;
        case '2':
        case 'team 2':
          return 3;
        case '1f':
        case 'team 1f':
          return 4;
        case '2f':
        case 'team 2f':
          return 5;
        case 'kjøkken':
          return 6;
        default:
          return 7;
      }
    };

    return [...filteredLeaders].sort((a, b) => {
      // 1. Admin først (prioritet 0)
      const aIsAdmin = adminIds.has(a.id);
      const bIsAdmin = adminIds.has(b.id);
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      
      // 2. Nurse deretter (prioritet 1)
      const aIsNurse = nurseIds.has(a.id);
      const bIsNurse = nurseIds.has(b.id);
      if (aIsNurse && !bIsNurse) return -1;
      if (!aIsNurse && bIsNurse) return 1;
      
      // 3. Sorter etter team-rekkefølge (Kordinator → Team 1 → osv.)
      const aOrder = getTeamSortOrder(a.team);
      const bOrder = getTeamSortOrder(b.team);
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // 4. Alfabetisk innenfor samme gruppe
      return a.name.localeCompare(b.name, 'nb');
    });
  }, [filteredLeaders, adminIds, nurseIds]);

  const handleEditClick = (leader: LeaderWithContent) => {
    setSelectedLeader(leader);
    setIsSheetOpen(true);
  };

  const handleContentSaved = () => {
    onLeaderUpdated();
    onScheduleAutoExport();
    // Refresh content
    const fetchContent = async () => {
      const { data: contentData } = await supabase
        .from('leader_content')
        .select('*');

      const leadersMap = activeLeaders.map(leader => ({
        ...leader,
        content: contentData?.find(c => c.leader_id === leader.id) || null
      }));

      setLeadersWithContent(leadersMap);
      
      // Update selected leader with new content
      if (selectedLeader) {
        const updatedLeader = leadersMap.find(l => l.id === selectedLeader.id);
        if (updatedLeader) {
          setSelectedLeader(updatedLeader);
        }
      }
    };
    fetchContent();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          <ChevronDown className={cn("h-4 w-4 transition-transform", showTeamFilters && "rotate-180")} />
        </Button>
        
        {showTeamFilters && (
          <>
            {TEAM_FILTERS.map(filter => (
              <Button
                key={filter.value}
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTeamFilter(activeTeamFilter === filter.value ? null : filter.value);
                }}
                className={cn(
                  "text-xs border-transparent hover:opacity-80",
                  filter.color,
                  activeTeamFilter === filter.value && "ring-2 ring-offset-1 ring-foreground"
                )}
              >
                {filter.label}
              </Button>
            ))}
            {activeTeamFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTeamFilter(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
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

      {/* Stats */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <span>{filteredLeaders.length} av {activeLeaders.length} ledere</span>
        {searchQuery && <span>· Søk: "{searchQuery}"</span>}
        {activeTeamFilter && <span>· Filter: {getActiveFilterLabel()}</span>}
      </div>

      {/* Leader Cards Grid - 2 columns on mobile, 3-4 on larger screens */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
        {sortedLeaders.map(leader => {
          const content = leader.content;
          const hasObs = !!content?.obs_message;
          const hasActivity = !!content?.current_activity;
          const hasExtraActivity = !!content?.extra_activity;
          const hasNotes = !!content?.personal_notes;
          
          // Border color logic: Kjøkken=purple, FRI=blue, Admin/Nurse/has_read=green, else red
          const isFri = content?.current_activity?.toLowerCase().includes('fri');
          const isKitchen = leader.team?.toLowerCase() === 'kjøkken';
          
          const isAdmin = adminIds.has(leader.id);
          const isNurse = nurseIds.has(leader.id);
          const isAdminOrNurse = isAdmin || isNurse;
          
          const getBorderClass = () => {
            // Admin og Nurse har alltid grønn ring (ingen Hajolo-knapp)
            if (isAdminOrNurse) return 'ring-green-500';
            // Kjøkken har alltid lilla ring
            if (isKitchen) return 'ring-purple-500';
            // "Fri" aktivitet gir blå ring
            if (isFri) return 'ring-blue-500';
            // Har lest (trykket Hajolo) = grønn
            if (content?.has_read) return 'ring-green-500';
            // Har ikke lest = rød
            return 'ring-red-500';
          };

          return (
            <Card 
              key={leader.id} 
              className={cn(
                'relative overflow-hidden transition-all hover:shadow-md cursor-pointer ring-2',
                // Fixed height on mobile, min-height on desktop
                'h-[100px] sm:h-auto sm:min-h-[220px]',
                getBorderClass()
              )}
              onClick={() => handleEditClick(leader)}
            >
              <CardContent className="p-2 sm:p-4 h-full flex flex-col">
                {/* Header with avatar and name - compact on mobile */}
                <div className="flex items-center sm:items-start gap-2 sm:gap-3 sm:mb-3">
                  <Avatar className="w-8 h-8 sm:w-12 sm:h-12 border-2 border-primary/20 shrink-0">
                    {leader.profile_image_url && (
                      <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm font-medium">
                      {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-xs sm:text-base truncate">
                      {getFirstName(leader.name)}
                    </h3>
                    {/* Ministerpost - hidden on mobile */}
                    {leader.ministerpost && (
                      <p className="hidden sm:block text-xs text-muted-foreground truncate">
                        {leader.ministerpost}
                      </p>
                    )}
                  </div>
                  
                  {/* OBS indicator - red dot on mobile only */}
                  {hasObs && (
                    <span className="sm:hidden w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" title="OBS-melding" />
                  )}
                  
                  {/* Team badge - compact on mobile, full on desktop */}
                  {(leader.team || isAdmin || isNurse) && (
                    <>
                      {/* Mobile: Compact badge */}
                      <Badge className={cn("sm:hidden text-[10px] px-1.5 py-0 shrink-0", getTeamStyles(isAdmin ? 'sjef' : isNurse ? 'nurse' : leader.team))}>
                        {formatTeamDisplayMobile(leader.team, isAdmin, isNurse)}
                      </Badge>
                      {/* Desktop: Full badge */}
                      <Badge className={cn("hidden sm:inline-flex text-xs", getTeamStyles(leader.team))}>
                        {formatTeamDisplay(leader.team)}
                      </Badge>
                    </>
                  )}
                  
                  {/* Edit button - hidden on mobile (whole card is clickable) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:flex h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(leader);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>

                {/* Activities - compact on mobile */}
                <div className="flex-1 mt-1 sm:mt-0 space-y-0.5 sm:space-y-2 min-h-0">
                  {/* Current Activity */}
                  <div className="flex items-center sm:items-start gap-1 sm:gap-2">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0 sm:mt-0.5" />
                    <p className={cn(
                      "text-xs sm:text-sm truncate",
                      hasActivity ? 'text-foreground' : 'text-muted-foreground italic'
                    )}>
                      {hasActivity ? content?.current_activity : '—'}
                    </p>
                  </div>

                  {/* Extra Activity - always show line on mobile for consistent height */}
                  <div className="flex items-center sm:items-start gap-1 sm:gap-2">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 sm:mt-0.5" />
                    <p className={cn(
                      "text-xs sm:text-sm truncate",
                      hasExtraActivity ? 'text-muted-foreground' : 'text-transparent'
                    )}>
                      {hasExtraActivity ? content?.extra_activity : '—'}
                    </p>
                  </div>

                  {/* Notes - hidden on mobile */}
                  <div className="hidden sm:flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className={cn(
                      "text-sm line-clamp-2",
                      hasNotes ? 'text-foreground' : 'text-muted-foreground italic'
                    )}>
                      {hasNotes ? content?.personal_notes : 'Ingen notater'}
                    </p>
                  </div>
                </div>

                {/* Badges - hidden on mobile, shown on desktop */}
                <div className="hidden sm:flex flex-wrap gap-1.5 mb-3">
                  {leader.cabin && (
                    <Badge variant="outline" className="text-xs">
                      {leader.cabin}
                    </Badge>
                  )}
                </div>

                {/* OBS Message - hidden on mobile, at bottom on desktop */}
                {hasObs && (
                  <Alert variant="destructive" className="hidden sm:flex mt-3 py-2 px-3 items-center justify-center text-center">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <AlertDescription className="text-xs line-clamp-2">
                      {content?.obs_message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLeaders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Ingen ledere funnet{searchQuery ? ` for "${searchQuery}"` : ''}</p>
        </div>
      )}

      {/* Edit Sheet */}
      <LeaderContentSheet
        leader={selectedLeader}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        homeConfig={homeConfig}
        onSaved={handleContentSaved}
      />
    </div>
  );
}
