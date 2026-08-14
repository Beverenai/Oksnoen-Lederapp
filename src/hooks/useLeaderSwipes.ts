import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SwipeCandidate = {
  id: string;
  name: string;
  profile_image_url: string | null;
  snus_user: boolean | null;
  snus_product_id: string | null;
  snus_custom_label: string | null;
  is_active: boolean | null;
  is_external: boolean | null;
  years: number[];
};

export type LeaderMatch = {
  id: string;
  created_at: string;
  leaderId: string;
  name: string;
  profile_image_url: string | null;
};

/** Everyone I have already swiped — used to skip them in the deck. */
function useMySwipes() {
  const { leader } = useAuth();
  return useQuery({
    queryKey: ['leader-swipes', leader?.id],
    enabled: !!leader?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_swipes')
        .select('target_leader_id, liked')
        .eq('swiper_leader_id', leader!.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/** My matches (mutual likes). Completely separate from Klinelista. */
export function useMyMatches() {
  const { leader } = useAuth();
  const queryClient = useQueryClient();
  const myId = leader?.id;

  const query = useQuery<LeaderMatch[]>({
    queryKey: ['leader-matches', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_matches')
        .select('id, created_at, leader_a_id, leader_b_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const otherIds = rows.map((r) => (r.leader_a_id === myId ? r.leader_b_id : r.leader_a_id));
      if (otherIds.length === 0) return [];
      const { data: leaders } = await supabase
        .from('leaders')
        .select('id, name, profile_image_url')
        .in('id', otherIds);
      const byId = new Map((leaders ?? []).map((l) => [l.id, l]));
      return rows.map((r) => {
        const otherId = r.leader_a_id === myId ? r.leader_b_id : r.leader_a_id;
        const l = byId.get(otherId);
        return {
          id: r.id,
          created_at: r.created_at,
          leaderId: otherId,
          name: l?.name ?? 'Ukjent leder',
          profile_image_url: l?.profile_image_url ?? null,
        };
      });
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('leader-matches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leader_matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['leader-matches'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

/**
 * The swipe deck: leaders who are not active this period (plus manually added
 * ones), minus myself, everyone I already swiped, and my existing matches.
 */
export function useSwipeCandidates() {
  const { leader, isLimitedAccess } = useAuth();
  const myId = leader?.id;
  const { data: swipes = [], isLoading: swipesLoading } = useMySwipes();
  const { data: matches = [] } = useMyMatches();

  const base = useQuery({
    queryKey: ['swipe-candidates'],
    queryFn: async () => {
      const [leadersRes, periodsRes] = await Promise.all([
        supabase
          .from('leaders')
          .select('id, name, profile_image_url, snus_user, snus_product_id, snus_custom_label, is_active, is_external')
          .order('name'),
        supabase.from('leader_service_periods').select('leader_id, year'),
      ]);

      const years = new Map<string, number[]>();
      ((periodsRes.data as { leader_id: string; year: number }[]) ?? []).forEach((r) => {
        const list = years.get(r.leader_id) ?? [];
        if (!list.includes(r.year)) list.push(r.year);
        years.set(r.leader_id, list);
      });

      return ((leadersRes.data ?? []) as Omit<SwipeCandidate, 'years'>[])
        .filter((l) => l.name.toLowerCase() !== 'superadmin')
        .map((l) => ({
          ...l,
          years: (years.get(l.id) ?? []).sort((a, b) => b - a),
        })) as SwipeCandidate[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const candidates = useMemo(() => {
    const swiped = new Set(swipes.map((s) => s.target_leader_id));
    const matched = new Set(matches.map((m) => m.leaderId));
    return (base.data ?? []).filter(
      (l) =>
        l.id !== myId &&
        !swiped.has(l.id) &&
        !matched.has(l.id) &&
        // Aktive ledere kan sveipe på alle; inaktive ser off-season-utvalget.
        (!isLimitedAccess || l.is_active === false || l.is_external === true),
    );
  }, [base.data, swipes, matches, myId, isLimitedAccess]);

  return {
    candidates,
    isLoading: base.isLoading || swipesLoading,
  };
}

export function useSwipeLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, liked }: { targetId: string; liked: boolean }) => {
      const { data, error } = await supabase.rpc('swipe_leader', {
        _target: targetId,
        _liked: liked,
      });
      if (error) throw error;
      return !!data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leader-swipes'] });
      queryClient.invalidateQueries({ queryKey: ['leader-matches'] });
    },
  });
}

export function useUnmatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.from('leader_matches').delete().eq('id', matchId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leader-matches'] }),
  });
}
