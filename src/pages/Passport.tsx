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
  AlertTriangle
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { BulkActivityRegistration } from '@/components/passport/BulkActivityRegistration';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
import { useAuth } from '@/contexts/AuthContext';
import { VirtualizedParticipantList } from '@/components/passport/VirtualizedParticipantList';
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
  const { data, error } = await supabase
    .from('leader_cabins')
    .select('cabin_id, leaders(id, name)');
  if (error) throw error;
  
  const map = new Map<string, { id: string; name: string }[]>();
  (data || []).forEach((lc: any) => {
    if (lc.cabin_id && lc.leaders) {
      const existing = map.get(lc.cabin_id) || [];
      existing.push({ id: lc.leaders.id, name: lc.leaders.name });
      map.set(lc.cabin_id, existing);
    }
  });
  return map;
}

export default function Passport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { leader, effectiveLeader } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const cabinFilterFromUrl = searchParams.get('cabin');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [myCabinsFilter, setMyCabinsFilter] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [expandedCabins, setExpandedCabins] = useState<Set<string>>(new Set());
  const [showBulkRegistration, setShowBulkRegistration] = useState(false);

  // React Query for cached data fetching
  const { data: participants = [], isLoading: isLoadingParticipants, refetch: refetchParticipants } = useQuery({
    queryKey: ['participants-with-cabins'],
    queryFn: fetchParticipants,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
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
    queryKey: ['leader-cabins-map'],
    queryFn: fetchLeaderCabins,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
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
    setSearchParams({});
  };

  // Handler for opening participant detail dialog
  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setIsDetailDialogOpen(true);
  };

  // Prefetch participant detail
  const prefetchParticipant = useCallback((participantId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['participant-detail', participantId],
      queryFn: async () => {
        const [participantRes, activitiesRes, healthRes] = await Promise.all([
          supabase.from('participants').select('*, cabins(id, name)').eq('id', participantId).single(),
          supabase.from('participant_activities').select('*').eq('participant_id', participantId),
          supabase.from('participant_health_info').select('*').eq('participant_id', participantId).maybeSingle()
        ]);
        return {
          participant: participantRes.data,
          activities: activitiesRes.data || [],
          healthInfo: healthRes.data
        };
      },
      staleTime: 30000,
    });
  }, [queryClient]);

  // Get activities for a participant
  const getParticipantActivities = (participantId: string): string[] => {
    return activitiesMap.get(participantId) || [];
  };

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
      
      return matchesSearch && matchesCabin;
    });
  }, [participants, searchQuery, myCabinsFilter, myCabinIds]);

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
      {/* Back button when filtered by cabin */}
      {(cabinFilterFromUrl || myCabinsFilter) && (
        <Button variant="ghost" onClick={clearCabinFilter} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tilbake til alle hytter
        </Button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            {myCabinsFilter && myCabinNames ? myCabinNames : 'Passkontroll'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {arrivedCount} av {participants.length} deltakere har ankommet
          </p>
        </div>

        {/* Action buttons in a row */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showBulkRegistration ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowBulkRegistration(!showBulkRegistration)}
          >
            <Users className="w-4 h-4 mr-1.5" />
            {showBulkRegistration ? 'Skjul' : 'Aktivitet'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/important-info')}
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Viktig Info
          </Button>
          
          {/* My cabin filter button - only show if leader has assigned cabins */}
          {myCabinIds.length > 0 && (
            <Button
              variant={myCabinsFilter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMyCabinsFilter(!myCabinsFilter)}
              className="gap-1.5"
            >
              <Home className="w-4 h-4" />
              {myCabinsFilter ? 'Alle hytter' : 'Min hytte'}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Activity Registration */}
      {showBulkRegistration && (
        <BulkActivityRegistration
          participants={participants}
          onComplete={loadData}
          onClose={() => setShowBulkRegistration(false)}
        />
      )}

      {/* Search Field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Søk etter navn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Checkout button - prominent placement when enabled */}
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
          Utsjekk
        </Button>
      )}

      {/* Virtualized Participant List */}
      <VirtualizedParticipantList
        cabinGroups={cabinGroups}
        activitiesMap={activitiesMap}
        expandedCabins={expandedCabins}
        onToggleCabin={toggleCabinExpanded}
        onParticipantClick={handleParticipantClick}
        onPrefetchParticipant={prefetchParticipant}
      />

      {/* Participant Detail Dialog */}
      <ParticipantDetailDialog
        participantId={selectedParticipantId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onParticipantUpdated={() => loadData()}
      />
    </div>
  );
}
