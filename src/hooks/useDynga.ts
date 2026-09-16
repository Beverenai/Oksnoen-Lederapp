import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

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
  /** Kort periodemerke, kun satt i «Alle perioder»-visning. */
  period_label?: string | null;
}

/** Velg alle perioder i Dynga (skrivebeskyttet visning på tvers). */
export const DYNGA_ALL_PERIODS = 'all';


export function useDyngaRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(uniqueRealtimeChannelName('dynga-rt'))
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

export function useDyngaColumns(periodId?: string | null) {
  const allMode = periodId === DYNGA_ALL_PERIODS;
  return useQuery<DyngaColumn[]>({
    queryKey: ['dynga-columns', periodId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('dynga_columns')
        .select('*')
        .order('sort_order', { ascending: true });
      if (periodId && !allMode) q = q.eq('period_id', periodId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: periodId !== undefined,
    staleTime: 30_000,
  });
}

export function useDyngaCards(periodId?: string | null) {
  const allMode = periodId === DYNGA_ALL_PERIODS;
  return useQuery<DyngaCardWithParticipant[]>({
    queryKey: ['dynga-cards', periodId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('dynga_cards')
        .select('*, participant:participants(id, name, first_name, last_name, image_url, cabin_id, cabins(id, name)), dynga_comments(count)')
        .order('sort_order', { ascending: true });
      if (periodId && !allMode) q = q.eq('period_id', periodId);
      const { data, error } = await q;
      if (error) throw error;

      let cards = (data || []).map((row: any) => ({
        ...row,
        comment_count: row.dynga_comments?.[0]?.count ?? 0,
      })) as DyngaCardWithParticipant[];

      if (allMode) {
        // Deltakere fra andre perioder er ikke lesbare via vanlig join (periodefilter),
        // så navn/bilde hentes fra sesongdataene i stedet.
        const missing = cards.some((c) => !c.participant);
        const [seasonRes, periodsRes] = await Promise.all([
          missing ? fetchSeasonParticipants().catch(() => []) : Promise.resolve([]),
          supabase.from('periods').select('id, name'),
        ]);
        const byId = new Map((seasonRes as any[]).map((p) => [p.id, p]));
        const periodName = new Map(((periodsRes.data || []) as any[]).map((p) => [p.id, p.name as string]));
        cards = cards.map((c) => {
          const sp: any = c.participant ? null : byId.get(c.participant_id);
          return {
            ...c,
            participant: c.participant ?? (sp
              ? {
                  id: sp.id,
                  name: sp.name,
                  first_name: sp.first_name ?? null,
                  last_name: sp.last_name ?? null,
                  image_url: sp.image_url ?? null,
                  cabin_id: sp.cabin_id ?? null,
                  cabins: sp.cabins ?? null,
                }
              : null),
            period_label: c.period_id
              ? (periodName.get(c.period_id) ?? '').replace(/^Periode\s*/i, 'P') || null
              : null,
          };
        });
      }

      return cards;
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
    mutationFn: async (col: { id?: string; title: string; color: string; sort_order: number; periodId?: string | null }) => {
      if (col.id) {
        const { error } = await supabase.from('dynga_columns').update({
          title: col.title, color: col.color, sort_order: col.sort_order,
        }).eq('id', col.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dynga_columns').insert({
          title: col.title,
          color: col.color,
          sort_order: col.sort_order,
          ...(col.periodId ? { period_id: col.periodId } : {}),
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
