import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  User,
  Home,
  ArrowLeft,
  Users,
  Sparkles,
  AlertTriangle,
  X,
  KeyRound,
  LayoutGrid,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
import { SecretWordsSheet } from '@/components/passport/SecretWordsSheet';
import { useSecretWordsActive } from '@/hooks/useSecretWordsActive';
import { useAuth } from '@/contexts/AuthContext';
import { VirtualizedParticipantList } from '@/components/passport/VirtualizedParticipantList';
import { PhotoWallView } from '@/components/passport/PhotoWallView';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { useParticipantTeams } from '@/hooks/useParticipantTeams';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { useIncidentCounts } from '@/hooks/useIncidentCounts';
import { useWentHomeParticipants } from '@/hooks/useWentHomeParticipants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeasonView } from '@/contexts/SeasonViewContext';
import { fetchSeasonParticipants } from '@/hooks/useSeasonParticipants';
import { Badge } from '@/components/ui/badge';

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
  team_id: string | null;
  period_id?: string | null;
  period_name?: string | null;
  cabins: Cabin | null;
}

interface CabinGroup {
  cabin: Cabin;
  participants: ParticipantWithCabin[];
  leaders: { id: string; name: string }[];
}

// Fetch participants with cabins directly from Supabase
async function fetchParticipants(): Promise<ParticipantWithCabin[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*, cabins(*)')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as ParticipantWithCabin[];
}

// Fetch all activities grouped by participant
async function fetchActivitiesMap(): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('participant_activities')
    .select('participant_id, activity');
  if (error) throw error;
  
  const map = new Map<string, string[]>();
  (data || []).forEach(a => {
    const existing = map.get(a.participant_id) || [];
    existing.push(a.activity);
    map.set(a.participant_id, existing);
  });
  return map;
}

// Fetch cabins
async function fetchCabins(): Promise<Cabin[]> {
  const { data, error } = await supabase
    .from('cabins')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Fetch leader cabins map
async function fetchLeaderCabins(): Promise<Map<string, { id: string; name: string }[]>> {
  const [leaderCabinsRes, activeLeadersRes] = await Promise.all([
    supabase
      .from('leader_cabins')
      .select('cabin_id, leader_id'),
    supabase
      .from('leaders')
      .select('id, name')
      .eq('is_active', true),
  ]);

  if (leaderCabinsRes.error) throw leaderCabinsRes.error;
  if (activeLeadersRes.error) throw activeLeadersRes.error;

  const activeLeaders = new Map(
    (activeLeadersRes.data || []).map((leader) => [leader.id, { id: leader.id, name: leader.name }])
  );
  
  const map = new Map<string, { id: string; name: string }[]>();
  (leaderCabinsRes.data || []).forEach((lc) => {
    const leader = activeLeaders.get(lc.leader_id);

    if (lc.cabin_id && leader) {
      const existing = map.get(lc.cabin_id) || [];
      existing.push(leader);
      map.set(lc.cabin_id, existing);
    }
  });

  return map;
}

export default function Passport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { leader, effectiveLeader, isAdmin, isNurse } = useAuth();
  const { data: incidentCounts } = useIncidentCounts(isAdmin || isNurse);
  const { data: wentHomeIds } = useWentHomeParticipants(isAdmin || isNurse);
  const { seasonView } = useSeasonView();
  const [searchParams, setSearchParams] = useSearchParams();
  const cabinFilterFromUrl = searchParams.get('cabin');
  const teamsParamFromUrl = searchParams.get('teams');
  const multiTeamIds = teamsParamFromUrl ? teamsParamFromUrl.split(',').filter(Boolean) : [];
  const kitchenDutyActive = searchParams.get('kitchenDuty') === '1';
  const statusFilterFromUrl = searchParams.get('status');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [myCabinsFilter, setMyCabinsFilter] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [secretWordsOpen, setSecretWordsOpen] = useState(false);
  const secretWordsActive = useSecretWordsActive();
  const [expandedCabins, setExpandedCabins] = useState<Set<string>>(new Set());
  const [photoWall, setPhotoWall] = useState(false);
  const [showAged, setShowAged] = useState(false);
  // (bulk activity registration moved to dedicated route /passport/activity)

  // React Query for cached data fetching
  const { data: participants = [], isLoading: isLoadingParticipants, refetch: refetchParticipants } = useQuery({
    queryKey: ['participants-with-cabins', seasonView ? 'season' : 'active'],
    queryFn: async () =>
      seasonView
        ? ((await fetchSeasonParticipants()) as unknown as ParticipantWithCabin[])
        : fetchParticipants(),
    staleTime: 0,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: activitiesMap = new Map<string, string[]>(), refetch: refetchActivities } = useQuery({
    queryKey: ['participant-activities-map'],
    queryFn: fetchActivitiesMap,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const { data: cabins = [] } = useQuery({
    queryKey: ['cabins'],
    queryFn: fetchCabins,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const { data: leaderCabins = new Map<string, { id: string; name: string }[]>() } = useQuery({
    queryKey: ['leader-cabins-map', 'active-only'],
    queryFn: fetchLeaderCabins,
    staleTime: 0,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: checkoutEnabled = false } = useQuery({
    queryKey: ['checkout-enabled'],
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'checkout_enabled').maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const teamsEnabled = useTeamsEnabled();
  const { data: teams = [] } = useParticipantTeams();

  // Realtime subscription for checkout_enabled
  useEffect(() => {
    const channel = supabase
      .channel('checkout-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload: any) => {
        if (payload.new?.key === 'checkout_enabled') {
          queryClient.invalidateQueries({ queryKey: ['checkout-enabled'] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Realtime subscription for participants — keeps arrival count live
  useEffect(() => {
    const channel = supabase
      .channel('passport-participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        queryClient.invalidateQueries({ queryKey: ['participants-with-cabins'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: myCabinIds = [] } = useQuery({
    queryKey: ['my-cabin-ids', effectiveLeader?.id],
    queryFn: async () => {
      if (!effectiveLeader?.id) return [];
      const { data } = await supabase
        .from('leader_cabins')
        .select('cabin_id')
        .eq('leader_id', effectiveLeader.id);
      return (data || []).map(c => c.cabin_id);
    },
    enabled: !!leader?.id,
    staleTime: 60000,
  });

  // Set expanded cabins when data loads
  useEffect(() => {
    if (cabins.length > 0 && expandedCabins.size === 0) {
      if (cabinFilterFromUrl) {
        setExpandedCabins(new Set([cabinFilterFromUrl]));
      } else {
        setExpandedCabins(new Set(cabins.map(c => c.id)));
      }
    }
  }, [cabins, cabinFilterFromUrl]);

  const loadData = useCallback(() => {
    refetchParticipants();
    refetchActivities();
  }, [refetchParticipants, refetchActivities]);


  const clearCabinFilter = () => {
    setMyCabinsFilter(false);
    setExpandedCabins(new Set(cabins.map((c) => c.id)));
    setSearchParams({}, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const clearStatusFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    setSearchParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  // Filter by specific cabin — triggered from cabin header click
  const handleFilterByCabin = useCallback((cabinId: string) => {
    setSearchQuery('');
    setMyCabinsFilter(false);
    setExpandedCabins(new Set([cabinId]));
    setSearchParams({ cabin: cabinId });
    window.scrollTo({ top: 0 });
  }, [setSearchParams]);

  // Handler for opening participant detail dialog
  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setIsDetailDialogOpen(true);
  };

  // Prefetch participant detail
  const prefetchParticipant = useCallback(() => {
    // Disabled to avoid persisted-cache deadlocks in participant detail dialog.
  }, []);

  // Get activities for a participant
  const getParticipantActivities = (participantId: string): string[] => {
    return activitiesMap.get(participantId) || [];
  };

  // Period options — only relevant while the season view is on.
  const periodOptions = useMemo(() => {
    const seen = new Map<string, string>();
    participants.forEach((p) => {
      if (p.period_id) seen.set(p.period_id, p.period_name || 'Ukjent periode');
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesName = p.name.toLowerCase().includes(query);
      const cabinName = p.cabins?.name?.toLowerCase() || '';
      const matchesCabinSearch = cabinName.includes(query);
      const matchesSearch = matchesName || matchesCabinSearch;

      // Filter by leader's cabins if "Min hytte" is active
      const matchesCabin = myCabinsFilter
        ? myCabinIds.includes(p.cabin_id || '')
        : true;

      // Filter by cabin URL param if present
      const matchesUrlCabin = cabinFilterFromUrl
        ? p.cabin_id === cabinFilterFromUrl
        : true;

      const matchesTeam =
        teamFilter === 'all'
          ? true
          : teamFilter === 'none'
          ? !p.team_id
          : p.team_id === teamFilter;

      const matchesMultiTeam = multiTeamIds.length > 0
        ? !!p.team_id && multiTeamIds.includes(p.team_id)
        : true;

      const matchesPeriod =
        periodFilter === 'all' ? true : p.period_id === periodFilter;

      const matchesStatus =
        statusFilterFromUrl === 'wenthome'
          ? !!wentHomeIds?.has(p.id)
          : statusFilterFromUrl === 'arrived'
          ? !!p.has_arrived
          : statusFilterFromUrl === 'notarrived'
          ? !p.has_arrived
          : true;

      return (
        matchesSearch && matchesCabin && matchesUrlCabin && matchesTeam && matchesMultiTeam && matchesPeriod && matchesStatus
      );
    });
  }, [participants, searchQuery, myCabinsFilter, myCabinIds, cabinFilterFromUrl, teamFilter, teamsParamFromUrl, periodFilter, statusFilterFromUrl, wentHomeIds]);

  // Group participants by cabin
  const cabinGroups = useMemo((): CabinGroup[] => {
    const groups: CabinGroup[] = [];
    const cabinMap = new Map<string, ParticipantWithCabin[]>();
    const uncategorized: ParticipantWithCabin[] = [];

    filteredParticipants.forEach(p => {
      if (p.cabin_id && p.cabins) {
        const existing = cabinMap.get(p.cabin_id) || [];
        existing.push(p);
        cabinMap.set(p.cabin_id, existing);
      } else {
        uncategorized.push(p);
      }
    });

    cabins.forEach(cabin => {
      const cabinParticipants = cabinMap.get(cabin.id);
      if (cabinParticipants && cabinParticipants.length > 0) {
        groups.push({ 
          cabin, 
          participants: cabinParticipants,
          leaders: leaderCabins.get(cabin.id) || []
        });
      }
    });

    if (uncategorized.length > 0) {
      groups.push({
        cabin: { id: 'uncategorized', name: 'Uten hytte', sort_order: 999, created_at: null },
        participants: uncategorized,
        leaders: []
      });
    }

    return groups;
  }, [filteredParticipants, cabins, leaderCabins]);

  const arrivedCount = participants.filter((p) => p.has_arrived).length;
  const passWrittenCount = participants.filter((p) => p.pass_written).length;
  const wentHomeCount = wentHomeIds
    ? participants.filter((p) => wentHomeIds.has(p.id)).length
    : 0;

  const toggleCabinExpanded = (cabinId: string) => {
    const newExpanded = new Set(expandedCabins);
    if (newExpanded.has(cabinId)) {
      newExpanded.delete(cabinId);
    } else {
      newExpanded.add(cabinId);
    }
    setExpandedCabins(newExpanded);
  };

  if (isLoadingParticipants) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
        {/* Search skeleton */}
        <Skeleton className="h-10 w-full rounded-md" />
        {/* Cabin groups skeleton */}
        {[...Array(3)].map((_, cabinIdx) => (
          <div key={cabinIdx} className="space-y-3">
            {/* Cabin header */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Participants grid */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(4)].map((_, pIdx) => (
                <div key={pIdx} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-1">
                      <Skeleton className="h-5 w-12 rounded" />
                      <Skeleton className="h-5 w-8 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Get the filtered cabin names for display
  const myCabinNames = myCabinIds
    .map(id => cabins.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back bar when filtered by cabin or status — sticky so it's always reachable */}
      {(cabinFilterFromUrl || myCabinsFilter || statusFilterFromUrl) && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/80 backdrop-blur-md border-b">
          <Button
            variant="ghost"
            onClick={() => {
              hapticImpact('light');
              if (statusFilterFromUrl) {
                clearStatusFilter();
              } else {
                clearCabinFilter();
              }
            }}
            className="h-11 w-full justify-start px-2 text-base font-semibold"
          >
            <ArrowLeft className="w-5 h-5 mr-2 shrink-0" />
            <span className="truncate">
              {statusFilterFromUrl === 'wenthome'
                ? 'Tilbake til alle deltagere'
                : 'Tilbake til alle hytter'}
            </span>
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            {cabinFilterFromUrl
              ? cabins.find((c) => c.id === cabinFilterFromUrl)?.name ?? 'Passkontroll'
              : myCabinsFilter && myCabinNames
              ? myCabinNames
              : 'Passkontroll'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {arrivedCount} av {participants.length} deltakere har ankommet
          </p>
          {wentHomeCount > 0 && (
            <p className="text-muted-foreground text-sm">
              {arrivedCount - wentHomeCount} igjen i leir · {wentHomeCount} har dratt hjem
            </p>
          )}
          {checkoutEnabled && (
            <p className="text-muted-foreground text-sm">
              {passWrittenCount} av {participants.length} pass skrevet
            </p>
          )}
        </div>

        {/* Primary actions as big floating tiles */}
        <div className="flex flex-col gap-2 sm:min-w-[19rem]">
          <div className="grid grid-cols-2 gap-2">
            {!seasonView && (
              <button
                type="button"
                onClick={() => navigate('/passport/activity')}
                className="ios-surface flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-transform active:scale-[0.97]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight text-foreground">Aktivitet</span>
                  <span className="block text-[11px] text-muted-foreground">Registrer</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/important-info')}
              className="ios-surface flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-transform active:scale-[0.97]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight text-foreground">Viktig info</span>
                <span className="block text-[11px] text-muted-foreground">Husk dette</span>
              </span>
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setPhotoWall((v) => !v);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-transform active:scale-95 ${
                photoWall
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'ios-chip text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {photoWall ? 'Vanlig liste' : 'Bildevisning'}
            </button>
            <button
              type="button"
              onClick={() => setShowAged((v) => !v)}
              aria-pressed={showAged}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-transform active:scale-95 ${
                showAged
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'ios-chip text-foreground'
              }`}
            >
              {showAged ? 'Gammel' : 'Ung'}
            </button>
              {!seasonView && secretWordsActive && (
                <button
                  type="button"
                  onClick={() => setSecretWordsOpen(true)}
                  className="ios-chip inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-foreground active:scale-95 transition-transform"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Ord
                </button>
              )}
              {myCabinIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMyCabinsFilter(!myCabinsFilter)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-transform active:scale-95 ${
                    myCabinsFilter
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'ios-chip text-foreground'
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  {myCabinsFilter ? 'Alle hytter' : 'Min hytte'}
                </button>
              )}
          </div>
        </div>
      </div>

      {/* Search Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          (e.currentTarget.querySelector('input') as HTMLInputElement)?.blur();
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Søk etter navn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              (document.activeElement as HTMLElement)?.blur();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Tøm søk"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </form>

      {/* Search result summary — counts per match */}
      {searchQuery.trim().length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {filteredParticipants.length} deltakere
          </Badge>
          <Badge variant="outline" className="text-xs">
            {cabinGroups.length} {cabinGroups.length === 1 ? 'hytte' : 'hytter'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {filteredParticipants.filter((p) => p.has_arrived).length} ankommet
          </Badge>
          {cabinGroups.map((g) => (
            <Badge key={g.cabin.id} variant="secondary" className="text-xs">
              {g.cabin.name}: {g.participants.length}
            </Badge>
          ))}
        </div>
      )}

      {/* Period filter — season view only */}
      {seasonView && periodOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Alle perioder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle perioder ({participants.length})</SelectItem>
              {periodOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {filteredParticipants.length} vises
          </Badge>
        </div>
      )}

      {/* Team filter — only when teams are enabled */}
      {teamsEnabled && teams.length > 0 && (
        <div className="space-y-2">
          {kitchenDutyActive && multiTeamIds.length > 0 && (() => {
            const selectedTeams = teams.filter((t) => multiTeamIds.includes(t.id));
            return (
              <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {selectedTeams.map((t) => (
                      <span
                        key={t.id}
                        className="w-9 h-9 rounded-full border-2 border-background shadow-sm flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: t.color }}
                        title={t.name}
                      >
                        {t.slot}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                      Kjøkkentjeneste i dag
                    </p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {selectedTeams.map((t) => t.name).join(' & ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Fjern filter"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete('teams');
                      next.delete('kitchenDuty');
                      setSearchParams(next);
                    }}
                    className="shrink-0 p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })()}
          {!kitchenDutyActive && multiTeamIds.length > 0 && (
            <Badge
              variant="secondary"
              className="gap-1.5 cursor-pointer"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('teams');
                setSearchParams(next);
              }}
            >
              {`${multiTeamIds.length} lag valgt`}
              <X className="w-3 h-3" />
            </Badge>
          )}
          <div className="flex items-center gap-2">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrer etter lag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle lag</SelectItem>
              <SelectItem value="none">Uten lag</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {teamFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setTeamFilter('all')}>
              <X className="w-4 h-4" />
            </Button>
          )}
          </div>
        </div>
      )}

      {/* Pass / Utsjekk overview button - only when checkout is enabled */}
      {checkoutEnabled && (
        <Button
          variant="default"
          size="lg"
          onClick={() => {
            hapticImpact('medium');
            navigate('/checkout');
          }}
          className="w-full gap-2 text-lg py-6"
        >
          <Sparkles className="w-5 h-5" />
          Pass-oversikt ({passWrittenCount}/{participants.length})
        </Button>
      )}

      {/* Participant list — photo wall or virtualized list */}
      {photoWall ? (
        <PhotoWallView
          cabinGroups={cabinGroups}
          showAged={showAged}
          onParticipantClick={handleParticipantClick}
          onPrefetchParticipant={prefetchParticipant}
        />
      ) : (
        <div className="w-full max-w-2xl mx-auto">
          <VirtualizedParticipantList
            cabinGroups={cabinGroups}
            activitiesMap={activitiesMap}
            expandedCabins={expandedCabins}
            onToggleCabin={toggleCabinExpanded}
            onFilterByCabin={handleFilterByCabin}
            onParticipantClick={handleParticipantClick}
            onPrefetchParticipant={prefetchParticipant}
            incidentCounts={incidentCounts}
            wentHomeIds={wentHomeIds}
            showAged={showAged}
          />
        </div>
      )}

      {/* Participant Detail Dialog */}
      <ParticipantDetailDialog
        participantId={selectedParticipantId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onParticipantUpdated={() => loadData()}
      />

      <SecretWordsSheet open={secretWordsOpen} onOpenChange={setSecretWordsOpen} />
    </div>
  );
}
