import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, Activity, Cross, ArrowUpDown, Check } from 'lucide-react';
import { LeaderDetailSheet } from '@/components/leaders/LeaderDetailSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;
type ExtraFieldConfig = Tables<'extra_fields_config'>;

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
}

type SortOption = 'name' | 'activity' | 'team';

// Team definitions with colors
const TEAMS = [
  { key: 'team 1', label: 'Team 1', bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' },
  { key: 'team 2', label: 'Team 2', bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' },
  { key: 'team 1f', label: 'Team 1F', bg: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-400' },
  { key: 'team 2f', label: 'Team 2F', bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
  { key: 'kjøkken', label: 'Kjøkken', bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500' },
  { key: 'joker', label: 'Joker', bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-500' },
  { key: 'sjef', label: 'Sjef', bg: 'bg-slate-600', text: 'text-white', border: 'border-slate-600' },
  { key: 'nurse', label: 'Nurse', bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-600' },
];

// Team color mapping based on provided design
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  const teamConfig = TEAMS.find(t => t.key === teamLower);
  if (teamConfig) {
    return `${teamConfig.bg} ${teamConfig.text} ${teamConfig.border}`;
  }
  return 'bg-muted text-muted-foreground border-border';
};

export default function Leaders() {
  const [leaders, setLeaders] = useState<LeaderWithContent[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  
  // Filter and sort state
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [activeCabinFilter, setActiveCabinFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    try {
      // Fetch leaders, content, roles, and extra fields config in parallel
      const [leadersRes, contentRes, rolesRes, configRes] = await Promise.all([
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
          .order('sort_order')
      ]);

      const leadersData = leadersRes.data || [];
      const contentData = contentRes.data || [];
      const rolesData = rolesRes.data || [];
      const configData = configRes.data || [];

      // Create lookup maps
      const contentMap = new Map(contentData.map(c => [c.leader_id, c]));
      const adminIds = new Set(rolesData.filter(r => r.role === 'admin').map(r => r.leader_id));
      const nurseIds = new Set(rolesData.filter(r => r.role === 'nurse').map(r => r.leader_id));

      const leadersWithContent: LeaderWithContent[] = leadersData.map((leader) => ({
        ...leader,
        content: contentMap.get(leader.id) || null,
        isAdmin: adminIds.has(leader.id),
        isNurse: nurseIds.has(leader.id),
      }));

      setLeaders(leadersWithContent);
      setExtraFieldsConfig(configData);
    } catch (error) {
      console.error('Error loading leaders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique teams from leaders for filter chips
  const availableTeams = useMemo(() => {
    const teamsInUse = new Set(
      leaders
        .map(l => l.team?.toLowerCase().trim())
        .filter(Boolean)
    );
    return TEAMS.filter(t => teamsInUse.has(t.key));
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

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          // Leaders with activity first
          const aHasActivity = !!a.content?.current_activity;
          const bHasActivity = !!b.content?.current_activity;
          if (aHasActivity !== bHasActivity) return bHasActivity ? 1 : -1;
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
  }, [leaders, activeTeamFilter, activeCabinFilter, sortBy]);

  // Get first name only
  const getFirstName = (fullName: string) => fullName.split(' ')[0];

  const handleTeamFilter = (teamKey: string | null) => {
    setActiveTeamFilter(prev => prev === teamKey ? null : teamKey);
  };

  const handleCabinFilter = (cabin: string | null) => {
    setActiveCabinFilter(prev => prev === cabin ? null : cabin);
  };

  const hasActiveFilter = activeTeamFilter || activeCabinFilter;

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
      {/* Header with sort button */}
      <div className="flex items-center justify-between">
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
        {filteredAndSortedLeaders.map((leader) => (
          <Card 
            key={leader.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.99]"
            onClick={() => setSelectedLeader(leader)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Profile image */}
                <Avatar className="w-12 h-12 shrink-0">
                  {leader.profile_image_url && (
                    <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-base">
                    {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">
                      {getFirstName(leader.name)}
                    </p>
                    {leader.isAdmin && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-500 text-white border-slate-500">
                        Admin
                      </Badge>
                    )}
                    {leader.isNurse && (
                      <span className="text-red-600 flex items-center" title="Sykepleier">
                        <Cross className="w-4 h-4" fill="currentColor" />
                      </span>
                    )}
                  </div>
                  
                  {leader.ministerpost && (
                    <p className="text-xs text-muted-foreground truncate">
                      {leader.ministerpost}
                    </p>
                  )}
                  
                  {/* Activity - prominent */}
                  {leader.content?.current_activity && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Activity className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-primary truncate">
                        {leader.content.current_activity}
                      </span>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {leader.team && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${getTeamStyles(leader.team)}`}>
                        {leader.team}
                      </Badge>
                    )}
                    {leader.cabin && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {leader.cabin}
                      </Badge>
                    )}
                  </div>
                </div>

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

      {/* Leader detail sheet */}
      <LeaderDetailSheet
        leader={selectedLeader}
        open={!!selectedLeader}
        onOpenChange={(open) => !open && setSelectedLeader(null)}
        extraFieldsConfig={extraFieldsConfig}
      />
    </div>
  );
}
