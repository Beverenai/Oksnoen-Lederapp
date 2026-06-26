import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type DyngaColumn = Tables<'dynga_columns'>;
export type DyngaCardRow = Tables<'dynga_cards'>;
export type DyngaComment = Tables<'dynga_comments'>;

export interface DyngaCardWithParticipant extends DyngaCardRow {
  participant: {
    id: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    cabin_id: string | null;
    cabins: { id: string; name: string } | null;
  } | null;
  comment_count: number;
}

export function useDyngaRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('dynga-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dynga_columns' }, () => {
        qc.invalidateQueries({ queryKey: ['dynga-columns'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dynga_cards' }, () => {
        qc.invalidateQueries({ queryKey: ['dynga-cards'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dynga_comments' }, () => {
        qc.invalidateQueries({ queryKey: ['dynga-cards'] });
        qc.invalidateQueries({ queryKey: ['dynga-comments'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

export function useDyngaColumns() {
  return useQuery<DyngaColumn[]>({
    queryKey: ['dynga-columns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dynga_columns')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useDyngaCards(periodId?: string | null) {
  return useQuery<DyngaCardWithParticipant[]>({
    queryKey: ['dynga-cards', periodId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('dynga_cards')
        .select('*, participant:participants(id, name, first_name, last_name, image_url, cabin_id, cabins(id, name)), dynga_comments(count)')
        .order('sort_order', { ascending: true });
      if (periodId) q = q.eq('period_id', periodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        comment_count: row.dynga_comments?.[0]?.count ?? 0,
      })) as DyngaCardWithParticipant[];
    },
    enabled: periodId !== undefined,
    staleTime: 10_000,
  });
}

export interface DyngaCommentWithLeader extends DyngaComment {
  leader: { id: string; name: string; profile_image_url: string | null } | null;
}

export function useDyngaComments(cardId: string | null) {
  return useQuery<DyngaCommentWithLeader[]>({
    queryKey: ['dynga-comments', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('dynga_comments')
        .select('*, leader:leaders(id, name, profile_image_url)')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DyngaCommentWithLeader[];
    },
    enabled: !!cardId,
    staleTime: 5_000,
  });
}

export function useMoveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, columnId, sortOrder }: { cardId: string; columnId: string; sortOrder: number }) => {
      const { error } = await supabase
        .from('dynga_cards')
        .update({ column_id: columnId, sort_order: sortOrder })
        .eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dynga-cards'] }),
  });
}

export function useMoveColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ columnId, sortOrder }: { columnId: string; sortOrder: number }) => {
      const { error } = await supabase
        .from('dynga_columns')
        .update({ sort_order: sortOrder })
        .eq('id', columnId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dynga-columns'] }),
  });
}

export function useAddCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantIds, columnId, initialComment, leaderId, periodId }: { participantIds: string[]; columnId: string; initialComment?: string; leaderId?: string | null; periodId?: string | null }) => {
      const { data: existing } = await supabase
        .from('dynga_cards')
        .select('sort_order')
        .eq('column_id', columnId)
        .order('sort_order', { ascending: false })
        .limit(1);
      let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const rows = participantIds.map(pid => ({
        participant_id: pid,
        column_id: columnId,
        sort_order: nextOrder++,
        ...(periodId ? { period_id: periodId } : {}),
      }));
      const { data: inserted, error } = await supabase.from('dynga_cards').insert(rows).select('id');
      if (error) throw error;
      const trimmed = initialComment?.trim();
      if (trimmed && leaderId && inserted && inserted.length > 0) {
        const commentRows = inserted.map((c: any) => ({
          card_id: c.id,
          leader_id: leaderId,
          body: trimmed,
        }));
        const { error: cErr } = await supabase.from('dynga_comments').insert(commentRows);
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dynga-cards'] }),
  });
}

export function useRemoveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase.from('dynga_cards').delete().eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dynga-cards'] }),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, leaderId, body }: { cardId: string; leaderId: string; body: string }) => {
      const { error } = await supabase.from('dynga_comments').insert({
        card_id: cardId,
        leader_id: leaderId,
        body,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['dynga-comments', vars.cardId] });
      qc.invalidateQueries({ queryKey: ['dynga-cards'] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string; cardId: string }) => {
      const { error } = await supabase.from('dynga_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['dynga-comments', vars.cardId] });
      qc.invalidateQueries({ queryKey: ['dynga-cards'] });
    },
  });
}

export function useUpsertColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (col: { id?: string; title: string; color: string; sort_order: number }) => {
      if (col.id) {
        const { error } = await supabase.from('dynga_columns').update({
          title: col.title, color: col.color, sort_order: col.sort_order,
        }).eq('id', col.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dynga_columns').insert({
          title: col.title, color: col.color, sort_order: col.sort_order,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dynga-columns'] }),
  });
}

export function useDeleteColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ columnId, fallbackColumnId }: { columnId: string; fallbackColumnId: string | null }) => {
      if (fallbackColumnId) {
        await supabase.from('dynga_cards').update({ column_id: fallbackColumnId }).eq('column_id', columnId);
      } else {
        await supabase.from('dynga_cards').delete().eq('column_id', columnId);
      }
      const { error } = await supabase.from('dynga_columns').delete().eq('id', columnId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynga-columns'] });
      qc.invalidateQueries({ queryKey: ['dynga-cards'] });
    },
  });
}
