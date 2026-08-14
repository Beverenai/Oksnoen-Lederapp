import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type MatchMessage = {
  id: string;
  match_id: string;
  sender_leader_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

/** Messages in one 1-to-1 match chat, live via realtime. */
export function useMatchMessages(matchId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<MatchMessage[]>({
    queryKey: ['match-messages', matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_match_messages')
        .select('id, match_id, sender_leader_id, body, created_at, read_at')
        .eq('match_id', matchId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MatchMessage[];
    },
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`match-chat-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leader_match_messages',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['match-messages', matchId] });
          queryClient.invalidateQueries({ queryKey: ['match-unread'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  return query;
}

export function useSendMatchMessage(matchId: string | null) {
  const { leader } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!matchId || !leader?.id) throw new Error('Mangler match');
      const { error } = await supabase.from('leader_match_messages').insert({
        match_id: matchId,
        sender_leader_id: leader.id,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-messages', matchId] });
    },
  });
}

/** Unread counts per match for the badge on match cards. */
export function useMatchUnread() {
  const { leader } = useAuth();
  const myId = leader?.id;
  return useQuery<Record<string, number>>({
    queryKey: ['match-unread', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_match_messages')
        .select('match_id, sender_leader_id, read_at')
        .is('read_at', null)
        .neq('sender_leader_id', myId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m) => {
        counts[m.match_id] = (counts[m.match_id] ?? 0) + 1;
      });
      return counts;
    },
    staleTime: 10_000,
  });
}

export function useMarkMatchRead() {
  const { leader } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      if (!leader?.id) return;
      await supabase
        .from('leader_match_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .is('read_at', null)
        .neq('sender_leader_id', leader.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match-unread'] }),
  });
}