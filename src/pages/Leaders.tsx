import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Users, Phone, Cross, ArrowUpDown, Check, Search, X, Home, Coffee, MessageSquare } from 'lucide-react';
import { LeaderDetailDialog } from '@/components/leaders/LeaderDetailDialog';
import { LeaderContentSheet } from '@/components/admin/LeaderContentSheet';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;
type ExtraFieldConfig = Tables<'extra_fields_config'>;

interface CabinInfo {
  id: string;
  name: string;
}

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
  linkedCabins?: CabinInfo[];
}

type SortOption = 'name' | 'activity' | 'team';

const FRI_ACTIVITY_REGEX = /(^|[\s/\\,.;:!?()[\]{}-])fri($|[\s/\\,.;:!?()[\]{}-])/i;

const isFriActivity = (activity?: string | null) =>
  FRI_ACTIVITY_REGEX.test(activity?.trim() ?? '');

const isLeaderFri = (leader: Pick<LeaderWithContent, 'content'>) =>
  isFriActivity(leader.content?.current_activity);

// Teams to show in filter chips (keys match database values)
const FILTER_TEAMS = [
  { key: '1', label: '1', bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' },
  { key: '2', label: '2', bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' },
  { key: '1f', label: '1F', bg: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-400' },
  { key: '2f', label: '2F', bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
  { key: 'kjøkken', label: 'Kjøkken', bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500' },
  { key: 'kordinator', label: 'Kordinator', bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-500' },
];

// All team colors for badge styling (keys match database values)
const ALL_TEAM_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' },
  '2': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' },
  '1f': { bg: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-400' },
  '2f': { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
  'kjøkken': { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500' },
  'kordinator': { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-500' },
  'sjef': { bg: 'bg-slate-600', text: 'text-white', border: 'border-slate-600' },
  'nurse': { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-600' },
};

// Team color mapping for badges
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  if (teamLower && ALL_TEAM_STYLES[teamLower]) {
    const style = ALL_TEAM_STYLES[teamLower];
    return `${style.bg} ${style.text} ${style.border}`;
  }
  return 'bg-muted text-muted-foreground border-border';
};

// Format team display: "1" -> "Team 1", "2f" -> "Team 2F", others unchanged
const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const t = team.trim();
  if (['1', '2', '1f', '2f'].includes(t.toLowerCase())) {
    return t.toUpperCase();
  }
  return team;
};

export default function Leaders() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canEdit = isAdmin || isSuperAdmin;
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  
  // Filter, sort and search state
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [activeCabinFilter, setActiveCabinFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('activity'); // Default to activity
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showTeamFilters, setShowTeamFilters] = useState(false);

  // Fetch leaders with React Query for caching
  const { data: leadersData, isLoading, refetch } = useQuery({
    queryKey: ['leaders-with-content'],
    queryFn: async () => {
      // Fetch leaders, public activities, roles, extra fields config, and leader_cabins in parallel
      const [leadersRes, contentRes, rolesRes, configRes, leaderCabinsRes] = await Promise.all([
        supabase
          .from('leaders')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('leader_activities_public' as any)
          .select('leader_id, current_activity, extra_activity'),
        supabase.rpc('get_all_leader_roles'),
        supabase
          .from('extra_fields_config')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order'),
        supabase
          .from('leader_cabins')
          .select(`
            leader_id,
            cabins!leader_cabins_cabin_id_fkey (
              id,
              name
            )
          `)
      ]);

      const leadersRaw = leadersRes.data || [];
      const contentData = ((contentRes.data || []) as unknown) as Array<{ leader_id: string; current_activity: string | null; extra_activity: string | null }>;
      const rolesData = rolesRes.data || [];
      const configData = configRes.data || [];
      const leaderCabinsData = leaderCabinsRes.data || [];

      // Create lookup maps
      const contentMap = new Map(contentData.map(c => [c.leader_id, c]));
      const adminIds = new Set(rolesData.filter(r => r.role === 'admin').map(r => r.leader_id));
      const nurseIds = new Set(rolesData.filter(r => r.role === 'nurse').map(r => r.leader_id));
      
      // Build leader -> cabins map
      const leaderCabinsMap = new Map<string, CabinInfo[]>();
      leaderCabinsData.forEach((lc: any) => {
        if (lc.cabins) {
          const existing = leaderCabinsMap.get(lc.leader_id) || [];
          existing.push({ id: lc.cabins.id, name: lc.cabins.name });
          leaderCabinsMap.set(lc.leader_id, existing);
        }
      });

      const leadersWithContent: LeaderWithContent[] = leadersRaw
        .filter((leader) => leader.name.toLowerCase() !== 'superadmin')
        .map((leader) => ({
          ...leader,
          content: (contentMap.get(leader.id) as unknown as LeaderContent) || null,
          isAdmin: adminIds.has(leader.id),
          isNurse: nurseIds.has(leader.id) || leader.team?.toLowerCase() === 'nurse',
          linkedCabins: leaderCabinsMap.get(leader.id) || [],
        }));

      return { leaders: leadersWithContent, extraFieldsConfig: configData };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const leaders = leadersData?.leaders || [];
  const extraFieldsConfig = leadersData?.extraFieldsConfig || [];

  // Admin-only: fetch full leader_content (public view hides personal_notes/obs/extras)
  // and home_screen_config so the editable sheet can render every field.
  const { data: fullContentData, refetch: refetchFullContent } = useQuery({
    queryKey: ['leader-content-full'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leader_content').select('*');
      if (error) throw error;
      return data || [];
    },
    enabled: canEdit,
    staleTime: 30_000,
  });

  const { data: homeConfig } = useQuery({
    queryKey: ['home-screen-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_screen_config')
        .select('id, element_key, label, title, icon, is_visible, sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: canEdit,
    staleTime: 5 * 60 * 1000,
  });

  const fullContentMap = useMemo(() => {
    const m = new Map<string, LeaderContent>();
    (fullContentData || []).forEach((c) => m.set(c.leader_id, c as LeaderContent));
    return m;
  }, [fullContentData]);

  // Merge full content into the selected leader for the edit sheet.
  const editableSelectedLeader = useMemo(() => {
    if (!canEdit || !selectedLeader) return null;
    const full = fullContentMap.get(selectedLeader.id);
    return full ? { ...selectedLeader, content: full } : selectedLeader;
  }, [canEdit, selectedLeader, fullContentMap]);

  // Format linked cabins display with "+" between them
  const formatCabinsDisplay = (cabins: CabinInfo[] | undefined): string => {
    if (!cabins || cabins.length === 0) return '';
    return cabins.map(c => c.name).join(' + ');
  };

  // Get teams for filter chips (only show FILTER_TEAMS that are in use)
  const availableTeams = useMemo(() => {
    const teamsInUse = new Set(
      leaders
        .map(l => l.team?.toLowerCase().trim())
        .filter(Boolean)
    );
    return FILTER_TEAMS.filter(t => teamsInUse.has(t.key));
  }, [leaders]);

  // Get unique cabins from leaders for filter chips
  const availableCabins = useMemo(() => {
    const cabins = leaders
      .map(l => l.cabin?.trim())
      .filter((cabin): cabin is string => !!cabin);
    return [...new Set(cabins)].sort((a, b) => a.localeCompare(b, 'nb'));
  }, [leaders]);

  // Filter and sort leaders
  const filteredAndSortedLeaders = useMemo(() => {
    let result = [...leaders];

    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(query) ||
        l.ministerpost?.toLowerCase().includes(query) ||
        l.team?.toLowerCase().includes(query) ||
        l.cabin?.toLowerCase().includes(query)
      );
    }

    // Apply team filter
    if (activeTeamFilter) {
      result = result.filter(
        l => l.team?.toLowerCase().trim() === activeTeamFilter
      );
    }

    // Apply cabin filter
    if (activeCabinFilter) {
      result = result.filter(
        l => l.cabin?.trim() === activeCabinFilter
      );
    }

    // Apply sorting - Priority roles at top, "Fri" and Kjøkken at the bottom
    result.sort((a, b) => {
      // Priority order helper: Statsminister first, then Visestatsminister/Admin, then Nurse
      const getPriority = (leader: LeaderWithContent) => {
        const ministerpost = leader.ministerpost?.toLowerCase() || '';
        const team = leader.team?.toLowerCase() || '';

        if (ministerpost === 'statsminister') return 0;
        if (ministerpost === 'visestatsminister' || ministerpost === 'vise-statsminister') return 1;
        if (leader.isAdmin) return 1; // Other admins at same level as visestatsminister
        if (leader.isNurse) return 2;
        if (team === 'kordinator') return 3;
        return 10; // Normal priority
      };
      
      const aPriority = getPriority(a);
      const bPriority = getPriority(b);
      
      // Priority leaders always at top
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Check if leader has "Fri" as the actual current activity, not words like Frisbee/Friluft
      const aIsFri = isLeaderFri(a);
      const bIsFri = isLeaderFri(b);
      
      const aIsKitchen = a.team?.toLowerCase() === 'kjøkken';
      const bIsKitchen = b.team?.toLowerCase() === 'kjøkken';
      
      // "Fri" leaders should be at the very bottom
      if (aIsFri && !bIsFri) return 1;
      if (!aIsFri && bIsFri) return -1;
      
      // Kjøkken at bottom (but above "Fri")
      if (aIsKitchen && !bIsKitchen) return 1;
      if (!aIsKitchen && bIsKitchen) return -1;
      
      switch (sortBy) {
        case 'activity':
          // Alfabetisk sortering basert på aktivitetsinnhold
          const aActivity = a.content?.current_activity || 'zzz';
          const bActivity = b.content?.current_activity || 'zzz';
          if (aActivity !== bActivity) return aActivity.localeCompare(bActivity, 'nb');
          return a.name.localeCompare(b.name, 'nb');
        case 'team':
          const aTeam = a.team || 'zzz';
          const bTeam = b.team || 'zzz';
          if (aTeam !== bTeam) return aTeam.localeCompare(bTeam, 'nb');
          return a.name.localeCompare(b.name, 'nb');
        default:
          return a.name.localeCompare(b.name, 'nb');
      }
    });

    // Hard group all non-Fri leaders before Fri leaders so the separator never captures everyone below it.
    const nonFriLeaders = result.filter((leader) => !isLeaderFri(leader));
    const friLeaders = result.filter(isLeaderFri);

    return [...nonFriLeaders, ...friLeaders];
  }, [leaders, activeTeamFilter, activeCabinFilter, sortBy, searchQuery]);

  // Find index of first "Fri" leader for separator (now at the very bottom, after Kjøkken)
  const firstFriIndex = useMemo(() => {
    return filteredAndSortedLeaders.findIndex(isLeaderFri);
  }, [filteredAndSortedLeaders]);
  
  // Get avatar border color class based on leader status
  const getAvatarBorderClass = (leader: LeaderWithContent) => {
    const isFri = isLeaderFri(leader);
    const isKitchen = leader.team?.toLowerCase() === 'kjøkken';
    const isSjef = leader.team?.toLowerCase() === 'sjef';
    
    if (isKitchen) return 'ring-4 ring-purple-500';
    if (isFri) return 'ring-4 ring-blue-500';
    if (isSjef) return 'ring-4 ring-green-500';
    if (leader.isAdmin || leader.isNurse || leader.content?.has_read) return 'ring-4 ring-green-500';
    return 'ring-4 ring-red-500';
  };

  // Get first name only
  const getFirstName = (fullName: string) => fullName.split(' ')[0];

  const handleTeamFilter = (teamKey: string | null) => {
    setActiveTeamFilter(prev => prev === teamKey ? null : teamKey);
  };

  const handleCabinFilter = (cabin: string | null) => {
    setActiveCabinFilter(prev => prev === cabin ? null : cabin);
  };

  const hasActiveFilter = activeTeamFilter || activeCabinFilter || searchQuery.trim();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
        {/* Filter chips skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        {/* Leader cards skeleton */}
        <div className="grid gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <Skeleton className="w-12 h-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in overflow-x-hidden w-full min-w-0 px-4">
      {/* Header with search and sort */}
      <div className="flex items-center justify-between gap-2">
        {isSearchOpen ? (
          // Expanded search bar
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter leder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          // Normal header
          <>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                Ledere
              </h1>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilter ? (
                  <>Viser {filteredAndSortedLeaders.length} av {leaders.length} ledere</>
                ) : (
                  <>{leaders.length} ledere registrert</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
              
              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    Sorter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setSortBy('name')} className="gap-2">
                    {sortBy === 'name' && <Check className="w-4 h-4" />}
                    <span className={sortBy !== 'name' ? 'ml-6' : ''}>Navn (A-Å)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('activity')} className="gap-2">
                    {sortBy === 'activity' && <Check className="w-4 h-4" />}
                    <span className={sortBy !== 'activity' ? 'ml-6' : ''}>Aktivitet først</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('team')} className="gap-2">
                    {sortBy === 'team' && <Check className="w-4 h-4" />}
                    <span className={sortBy !== 'team' ? 'ml-6' : ''}>Gruppert etter team</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* Team filter section */}
      {availableTeams.length > 0 && (
        <div className="space-y-2">
          {/* "Alle" button - always visible */}
          <button
            onClick={() => {
              if (activeTeamFilter) {
                // If a filter is active, clicking "Alle" clears it
                setActiveTeamFilter(null);
                setShowTeamFilters(false);
              } else {
                // If no filter, toggle the team chips visibility
                setShowTeamFilters(!showTeamFilters);
              }
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${!activeTeamFilter 
                ? 'bg-foreground text-background' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            Alle {!activeTeamFilter && (showTeamFilters ? '▲' : '▼')}
          </button>
          
          {/* Team chips - conditionally visible */}
          {(showTeamFilters || activeTeamFilter) && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 animate-fade-in">
              {availableTeams.map((team) => (
                <button
                  key={team.key}
                  onClick={() => {
                    const isCurrentlyActive = activeTeamFilter === team.key;
                    handleTeamFilter(team.key);
                    if (isCurrentlyActive) {
                      // Toggling off the current filter
                      setShowTeamFilters(false);
                    }
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2
                    ${activeTeamFilter === team.key
                      ? `${team.bg} ${team.text} ${team.border}`
                      : `bg-transparent ${team.border} hover:${team.bg}/20`
                    }`}
                >
                  {team.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaders list */}
      <div className="grid gap-2">
        {filteredAndSortedLeaders.map((leader, index) => (
          <div key={leader.id}>
            {/* Separator before first "Fri" leader */}
            {index === firstFriIndex && firstFriIndex > 0 && (
              <div className="flex items-center gap-3 py-3 mt-2 mb-2">
                <div className="h-px flex-1 bg-blue-400/50" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Coffee className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Ledere som har Fri
                  </span>
                </div>
                <div className="h-px flex-1 bg-blue-400/50" />
              </div>
            )}
            
            <Card
              className="cursor-pointer overflow-hidden rounded-[24px] shadow-sm h-[128px]"
              onClick={() => setSelectedLeader(leader)}
            >
              <CardContent className="p-4 h-full flex items-center">
                <div className="flex items-center gap-3 w-full min-h-0">
                  {/* Profile image with status ring */}
                  <Avatar
                    className={cn(
                      "w-[72px] h-[72px] shrink-0 ring-offset-2 ring-offset-background",
                      getAvatarBorderClass(leader)
                    )}
                  >
                    {leader.profile_image_url && (
                      <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                      {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5 overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="text-[17px] font-bold text-foreground leading-tight truncate">
                        {getFirstName(leader.name)}
                      </h3>
                      {leader.isNurse && (
                        <span className="text-red-600 flex items-center shrink-0" title="Sykepleier">
                          <Cross className="w-4 h-4" fill="currentColor" />
                        </span>
                      )}
                    </div>
                    {leader.ministerpost && (
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate mb-1">
                        {leader.ministerpost}
                      </p>
                    )}

                    {(leader.team || (leader.linkedCabins && leader.linkedCabins.length > 0) || leader.cabin) && (
                      <div className="flex flex-wrap gap-1 mb-1 line-clamp-1 overflow-hidden">
                        {leader.team && (
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md leading-none flex items-center h-4 border",
                              getTeamStyles(leader.team)
                            )}
                          >
                            {formatTeamDisplay(leader.team)}
                          </span>
                        )}
                        {leader.linkedCabins && leader.linkedCabins.length > 0 ? (
                          <span className="bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-md border border-border leading-none flex items-center h-4 gap-1 max-w-[160px]">
                            <Home className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{leader.linkedCabins[0].name}</span>
                            {leader.linkedCabins.length > 1 && (
                              <span className="shrink-0 font-bold">+{leader.linkedCabins.length - 1}</span>
                            )}
                          </span>
                        ) : leader.cabin ? (
                          <span className="bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-md border border-border leading-none flex items-center h-4">
                            {leader.cabin}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {leader.content?.current_activity && (
                      <div className="pt-1 border-t border-border/50">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          <span className="truncate">{leader.content.current_activity}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="default"
                          size="icon"
                          className="bg-green-600 hover:bg-green-700 text-white rounded-full h-11 w-11 shadow-md active:scale-90 transition-transform"
                          aria-label="Kontakt"
                        >
                          <Phone className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${leader.phone}`;
                          }}
                        >
                          <Phone className="w-4 h-4 mr-2 text-green-600" />
                          Ring
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `sms:${leader.phone}`;
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
                          Send SMS
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {filteredAndSortedLeaders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {hasActiveFilter ? 'Ingen ledere funnet' : 'Ingen ledere'}
            </h3>
            <p className="text-muted-foreground mt-1">
              {hasActiveFilter ? (
                <button 
                  onClick={() => { setActiveTeamFilter(null); setActiveCabinFilter(null); }}
                  className="text-primary underline"
                >
                  Vis alle ledere
                </button>
              ) : (
                'Kontakt admin for å bli lagt til'
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leader detail dialog - always read-only view on Ledere page.
          Admin editing lives in the Admin dashboard. */}
      <LeaderDetailDialog
        leader={selectedLeader}
        open={!!selectedLeader}
        onOpenChange={(open) => !open && setSelectedLeader(null)}
      />
    </div>
  );
}
