import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyMurderState {
  game_id: string;
  is_active: boolean;
  winner_leader_id: string | null;
  target_leader_id: string | null;
  target_name: string | null;
  target_image_url: string | null;
  is_alive: boolean;
  killed_by_name: string | null;
  kills: number;
  pending_claim_id: string | null;
  pending_claim_victim_name: string | null;
  incoming_claim_id: string | null;
  incoming_claim_killer_name: string | null;
  alive_count: number;
  total_count: number;
}

export interface MurderOverviewRow {
  leader_id: string;
  leader_name: string;
  target_leader_id: string | null;
  is_alive: boolean;
  killed_by: string | null;
  killed_at: string | null;
  kills: number;
  ring_order: number | null;
}

function useMurderRealtime(keys: unknown[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`murder-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'murder_players' }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'murder_kill_claims' }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'murder_games' }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
}

/** The signed-in leader's own murder-game state (null when not playing). */
export function useMyMurderState() {
  const { effectiveLeader } = useAuth() as { effectiveLeader?: { id: string } | null };
  useMurderRealtime([['murder-my-state'], ['murder-overview'], ['murder-game']]);

  return useQuery<MyMurderState | null>({
    queryKey: ['murder-my-state', effectiveLeader?.id ?? null],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_murder_state');
      if (error) throw error;
      const rows = (data ?? []) as unknown as MyMurderState[];
      return rows[0] ?? null;
    },
  });
}

/** The murder game row for the active period (admin toggle state). */
export function useMurderGame() {
  return useQuery({
    queryKey: ['murder-game'],
    staleTime: 10_000,
    queryFn: async () => {
      const { data: period } = await supabase
        .from('periods').select('id,name').eq('is_active', true).maybeSingle();
      if (!period) return null;
      const { data, error } = await supabase
        .from('murder_games').select('*').eq('period_id', period.id).maybeSingle();
      if (error) throw error;
      return data ? { ...data, periodName: period.name } : null;
    },
  });
}

/** Full chain overview — admin only (enforced in the database). */
export function useMurderOverview(enabled: boolean) {
  return useQuery<MurderOverviewRow[]>({
    queryKey: ['murder-overview'],
    enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_murder_overview');
      if (error) throw error;
      return (data ?? []) as unknown as MurderOverviewRow[];
    },
  });
}

export function usePendingMurderClaims(enabled: boolean) {
  return useQuery({
    queryKey: ['murder-pending-claims'],
    enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('murder_kill_claims')
        .select(`id, created_at, status,
          killer:leaders!murder_kill_claims_killer_leader_id_fkey(id,name),
          victim:leaders!murder_kill_claims_victim_leader_id_fkey(id,name)`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string; created_at: string; status: string;
        killer: { id: string; name: string } | null;
        victim: { id: string; name: string } | null;
      }[];
    },
  });
}

export function useMurderMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['murder-my-state'] });
    qc.invalidateQueries({ queryKey: ['murder-overview'] });
    qc.invalidateQueries({ queryKey: ['murder-game'] });
    qc.invalidateQueries({ queryKey: ['murder-pending-claims'] });
  };

  const claimKill = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('claim_murder_kill');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const confirmDeath = useMutation({
    mutationFn: async (claimId?: string | null) => {
      const { error } = await supabase.rpc('confirm_murder_death', {
        _claim_id: claimId ?? undefined,
      } as { _claim_id?: string });
      if (error) throw error;
      // Server-side authorized + idempotent broadcast. Derives the victim
      // itself; duplicate calls are safe (unique lock per confirmed claim).
      try {
        await supabase.functions.invoke('push-murder-death');
      } catch (e) {
        console.error('push-murder-death failed', e);
      }
    },
    onSuccess: invalidate,
  });

  const startGame = useMutation({
    mutationFn: async (leaderIds: string[]) => {
      const { error } = await supabase.rpc('start_murder_game', { _leader_ids: leaderIds });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase.rpc('set_murder_game_active', { _active: active });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const announceStart = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('push-murder-start');
      if (error) throw error;
      return data as { sent?: number; failed?: number; players?: number };
    },
  });

  const reviveAndReshuffle = useMutation({
    mutationFn: async (count?: number) => {
      const { data, error } = await supabase.rpc('revive_and_reshuffle_murder', { _count: count ?? 4 });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        leader_id: string; leader_name: string; was_revived: boolean;
      }[];
      const revivedIds = rows.filter((r) => r.was_revived).map((r) => r.leader_id);
      try {
        await supabase.functions.invoke('push-murder-reshuffle', {
          body: { revived_leader_ids: revivedIds },
        });
      } catch (e) {
        console.error('push-murder-reshuffle failed', e);
      }
      return rows;
    },
    onSuccess: invalidate,
  });

  return { claimKill, confirmDeath, startGame, setActive, announceStart, reviveAndReshuffle };
}