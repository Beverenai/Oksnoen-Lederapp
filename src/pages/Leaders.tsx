import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Users, Phone, Activity, Cross, ArrowUpDown, Check, Search, X, Home, Coffee } from 'lucide-react';
import { LeaderDetailDialog } from '@/components/leaders/LeaderDetailDialog';
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
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  return team;
};

export default function Leaders() {
  const [leaders, setLeaders] = useState<LeaderWithContent[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  
  // Filter, sort and search state
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [activeCabinFilter, setActiveCabinFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('activity'); // Default to activity
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    try {
      // Fetch leaders, content, roles, extra fields config, and leader_cabins in parallel
      const [leadersRes, contentRes, rolesRes, configRes, leaderCabinsRes] = await Promise.all([
        supabase
          .from('leaders')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('leader_content')
          .select('*'),
        supabase
          .from('user_roles')
          .select('leader_id, role'),
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

      const leadersData = leadersRes.data || [];
      const contentData = contentRes.data || [];
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

      const leadersWithContent: LeaderWithContent[] = leadersData
        .filter((leader) => leader.name.toLowerCase() !== 'superadmin')
        .map((leader) => ({
          ...leader,
          content: contentMap.get(leader.id) || null,
          isAdmin: adminIds.has(leader.id),
          isNurse: nurseIds.has(leader.id) || leader.team?.toLowerCase() === 'nurse',
          linkedCabins: leaderCabinsMap.get(leader.id) || [],
        }));

      setLeaders(leadersWithContent);
      setExtraFieldsConfig(configData);
    } catch (error) {
      console.error('Error loading leaders:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        
        if (ministerpost === 'statsminister') return 0;
        if (ministerpost === 'visestatsminister' || ministerpost === 'vise-statsminister') return 1;
        if (leader.isAdmin) return 1; // Other admins at same level as visestatsminister
        if (leader.isNurse) return 2;
        return 10; // Normal priority
      };
      
      const aPriority = getPriority(a);
      const bPriority = getPriority(b);
      
      // Priority leaders always at top
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Check if leader has "Fri" as activity
      const aIsFri = a.content?.current_activity?.toLowerCase().includes('fri');
      const bIsFri = b.content?.current_activity?.toLowerCase().includes('fri');
      
      const aIsKitchen = a.team?.toLowerCase() === 'kjøkken';
      const bIsKitchen = b.team?.toLowerCase() === 'kjøkken';
      
      // Kjøkken always at very bottom
      if (aIsKitchen && !bIsKitchen) return 1;
      if (!aIsKitchen && bIsKitchen) return -1;
      
      // "Fri" leaders should be at bottom (but above Kjøkken)
      if (aIsFri && !bIsFri) return 1;
      if (!aIsFri && bIsFri) return -1;
      
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

    return result;
  }, [leaders, activeTeamFilter, activeCabinFilter, sortBy, searchQuery]);

  // Find index of first "Fri" leader for separator
  const firstFriIndex = useMemo(() => {
    return filteredAndSortedLeaders.findIndex(leader => 
      leader.content?.current_activity?.toLowerCase().includes('fri') &&
      leader.team?.toLowerCase() !== 'kjøkken' // Exclude Kjøkken from "Fri" section
    );
  }, [filteredAndSortedLeaders]);
  
  // Get avatar border color class based on leader status
  const getAvatarBorderClass = (leader: LeaderWithContent) => {
    const isFri = leader.content?.current_activity?.toLowerCase().includes('fri');
    const isKitchen = leader.team?.toLowerCase() === 'kjøkken';
    
    if (isKitchen) return 'ring-4 ring-purple-500';
    if (isFri) return 'ring-4 ring-blue-500';
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
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
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

      {/* Team filter chips - horizontal scroll */}
      {availableTeams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {/* "Alle" chip */}
          <button
            onClick={() => setActiveTeamFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${!activeTeamFilter 
                ? 'bg-foreground text-background' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            Alle
          </button>
          
          {/* Team chips */}
          {availableTeams.map((team) => (
            <button
              key={team.key}
              onClick={() => handleTeamFilter(team.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2
                ${activeTeamFilter === team.key
                  ? `${team.bg} ${team.text} ${team.border}`
                  : `bg-transparent ${team.border} hover:${team.bg}/20`
                }`}
              style={{
                borderColor: activeTeamFilter !== team.key ? undefined : undefined,
              }}
            >
              {team.label}
            </button>
          ))}
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
                    Ledere på fri
                  </span>
                </div>
                <div className="h-px flex-1 bg-blue-400/50" />
              </div>
            )}
            
            <Card 
              className="cursor-pointer transition-colors active:scale-[0.99]"
              onClick={() => setSelectedLeader(leader)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Profile image with status ring */}
                  <Avatar className={cn("w-12 h-12 shrink-0", getAvatarBorderClass(leader))}>
                    {leader.profile_image_url && (
                      <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-base">
                      {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {getFirstName(leader.name)}
                    </p>
                    
                    {leader.ministerpost && (
                      <p className="text-xs text-muted-foreground truncate">
                        {leader.ministerpost}
                      </p>
                    )}
                    
                    {/* Activity - prominent */}
                    {leader.content?.current_activity && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Activity className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-base font-semibold text-primary truncate">
                          {leader.content.current_activity}
                        </span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {leader.team && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${getTeamStyles(leader.team)}`}>
                          {formatTeamDisplay(leader.team)}
                        </Badge>
                      )}
                      {leader.linkedCabins && leader.linkedCabins.length > 0 ? (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0 flex items-center gap-1"
                        >
                          <Home className="w-3 h-3" />
                          {formatCabinsDisplay(leader.linkedCabins)}
                        </Badge>
                      ) : leader.cabin && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {leader.cabin}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Nurse indicator */}
                  {leader.isNurse && (
                    <span className="shrink-0 text-red-600 flex items-center" title="Sykepleier">
                      <Cross className="w-6 h-6" fill="currentColor" />
                    </span>
                  )}

                  {/* Call button - smaller */}
                  <Button
                    variant="default"
                    size="icon"
                    className="shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-full h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `tel:${leader.phone}`;
                    }}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
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

      {/* Leader detail dialog */}
      <LeaderDetailDialog
        leader={selectedLeader}
        open={!!selectedLeader}
        onOpenChange={(open) => !open && setSelectedLeader(null)}
      />
    </div>
  );
}
