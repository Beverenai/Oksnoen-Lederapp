import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';

export type HookupStatus = 'pending' | 'confirmed' | 'declined';

/**
 * Server-side push for a hookup event. The edge function derives both parties
 * from the row, so no one can send a notification in someone else's name.
 * Failures are swallowed — a missing push must never fail the action itself.
 */
async function notifyHookup(hookupId: string, kind: 'requested' | 'confirmed') {
  try {
    await supabase.functions.invoke('push-hookup', {
      body: { hookup_id: hookupId, kind },
    });
  } catch (e) {
    console.warn('push-hookup failed', e);
  }
}

export interface Hookup {
  id: string;
  period_id: string | null;
  leader_a_id: string;
  leader_b_id: string;
  requested_by: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
}

/** Whether the "Klineliste" module is enabled globally (realtime synced). */
export function useHookupsEnabled() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['hookups-enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'hookups_enabled')
        .maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('hookups-enabled-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config' },
        (payload: any) => {
          if (payload.new?.key === 'hookups_enabled' || payload.old?.key === 'hookups_enabled') {
            queryClient.invalidateQueries({ queryKey: ['hookups-enabled'] });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query.data ?? false;
}

export function useSetHookupsEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'hookups_enabled', value: value ? 'true' : 'false' }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hookups-enabled'] }),
  });
}

/** All hookup rows visible to the current leader for the active period. */
export function useHookups() {
  const { data: periodId } = useActivePeriodId();
  const queryClient = useQueryClient();

  const query = useQuery<Hookup[]>({
    queryKey: ['hookups', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_hookups')
        .select('id, period_id, leader_a_id, leader_b_id, requested_by, status, confirmed_at, created_at')
        .eq('period_id', periodId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Hookup[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('hookups-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leader_hookups' }, () => {
        queryClient.invalidateQueries({ queryKey: ['hookups'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

/** Splits the visible rows into the buckets the UI needs. */
export function useMyHookups() {
  const { leader } = useAuth();
  const { data: rows = [], isLoading } = useHookups();
  const myId = leader?.id;

  return useMemo(() => {
    const mine = rows.filter((r) => r.leader_a_id === myId || r.leader_b_id === myId);
    return {
      isLoading,
      confirmed: rows.filter((r) => r.status === 'confirmed'),
      myConfirmed: mine.filter((r) => r.status === 'confirmed'),
      incoming: mine.filter((r) => r.status === 'pending' && r.requested_by !== myId),
      outgoing: mine.filter((r) => r.status === 'pending' && r.requested_by === myId),
      partnerIds: new Set(
        mine.map((r) => (r.leader_a_id === myId ? r.leader_b_id : r.leader_a_id)),
      ),
    };
  }, [rows, myId, isLoading]);
}

/** Number of requests waiting for my confirmation — used for the badge in Mer. */
export function useIncomingHookupCount() {
  const { incoming } = useMyHookups();
  return incoming.length;
}

export function useRequestHookup() {
  const { leader } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherLeaderId: string) => {
      const myId = leader?.id;
      if (!myId) throw new Error('Ingen leder');
      if (myId === otherLeaderId) throw new Error('Du kan ikke velge deg selv');

      // Manually added (external) leaders have no account to confirm with, so
      // the connection is stored as confirmed right away.
      const { data: other } = await supabase
        .from('leaders')
        .select('is_external')
        .eq('id', otherLeaderId)
        .maybeSingle();
      const external = !!other?.is_external;

      const [a, b] = [myId, otherLeaderId].sort();
      const { data: inserted, error } = await supabase
        .from('leader_hookups')
        .insert({
          leader_a_id: a,
          leader_b_id: b,
          requested_by: myId,
          status: external ? 'confirmed' : 'pending',
          confirmed_at: external ? new Date().toISOString() : null,
        })
        .select('id')
        .maybeSingle();
      if (error) {
        if (error.code === '23505' || error.code === '23514' || error.message.includes('duplicate')) {
          throw new Error('Denne koblingen finnes allerede');
        }
        throw error;
      }

      if (!external && inserted?.id) {
        await notifyHookup(inserted.id, 'requested');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hookups'] }),
  });
}

export function useRespondToHookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase
        .from('leader_hookups')
        .update({
          status: accept ? 'confirmed' : 'declined',
          confirmed_at: accept ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
      // Declines are silent on purpose.
      if (accept) await notifyHookup(id, 'confirmed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hookups'] }),
  });
}

export function useDeleteHookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leader_hookups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hookups'] }),
  });
}

/** Registers a former leader who is not in the app (Klineliste only). */
export function useAddExternalLeader() {
  const queryClient = useQueryClient();
  const request = useRequestHookup();

  return useMutation({
    mutationFn: async ({
      name,
      gender,
      connect = true,
    }: {
      name: string;
      gender: 'male' | 'female' | null;
      connect?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('add_external_leader', {
        _name: name.trim(),
        _gender: gender,
      });
      if (error) throw error;
      const newId = data as unknown as string;
      if (connect && newId) await request.mutateAsync(newId);
      return newId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaders'] });
      queryClient.invalidateQueries({ queryKey: ['hookups'] });
    },
  });
}

/** Deletes a manually added leader (and their connections, via cascade). */
export function useDeleteExternalLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leaderId: string) => {
      await supabase
        .from('leader_hookups')
        .delete()
        .or(`leader_a_id.eq.${leaderId},leader_b_id.eq.${leaderId}`);
      const { error } = await supabase
        .from('leaders')
        .delete()
        .eq('id', leaderId)
        .eq('is_external', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaders'] });
      queryClient.invalidateQueries({ queryKey: ['hookups'] });
    },
  });
}