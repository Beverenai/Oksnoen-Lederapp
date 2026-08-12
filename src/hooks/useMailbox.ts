import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type MailboxCategory = 'question' | 'idea' | 'praise' | 'concern' | 'other';
export type MailboxStatus = 'new' | 'read' | 'replied';

export interface MailboxMessage {
  id: string;
  created_at: string;
  category: string;
  content: string;
  is_anonymous: boolean;
  sender_leader_id: string;
  status: string;
  read_at: string | null;
  admin_reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
}

export const MAILBOX_CATEGORIES: { value: MailboxCategory; label: string; emoji: string }[] = [
  { value: 'question', label: 'Spørsmål', emoji: '❓' },
  { value: 'idea', label: 'Forslag', emoji: '💡' },
  { value: 'praise', label: 'Ros', emoji: '⭐' },
  { value: 'concern', label: 'Bekymring', emoji: '⚠️' },
  { value: 'other', label: 'Annet', emoji: '✉️' },
];

export const categoryLabel = (v: string) =>
  MAILBOX_CATEGORIES.find((c) => c.value === v)?.label ?? 'Annet';
export const categoryEmoji = (v: string) =>
  MAILBOX_CATEGORIES.find((c) => c.value === v)?.emoji ?? '✉️';

export const statusLabel = (s: string) =>
  s === 'replied' ? 'Besvart' : s === 'read' ? 'Lest' : 'Ny';

/** Realtime-oppdatering av postkassen */
export function useMailboxRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('mailbox-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mailbox_messages' },
        () => {
          qc.invalidateQueries({ queryKey: ['mailbox'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/** Mine egne innsendte meldinger */
export function useMyMailboxMessages() {
  const { leader, effectiveLeader } = useAuth();
  const leaderId = effectiveLeader?.id ?? leader?.id ?? null;
  return useQuery({
    queryKey: ['mailbox', 'mine', leaderId],
    enabled: !!leaderId,
    queryFn: async (): Promise<MailboxMessage[]> => {
      const { data, error } = await supabase
        .from('mailbox_messages')
        .select('*')
        .eq('sender_leader_id', leaderId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MailboxMessage[];
    },
  });
}

/** Alle meldinger (kun admin får rader pga RLS) */
export function useAllMailboxMessages(enabled: boolean) {
  return useQuery({
    queryKey: ['mailbox', 'all'],
    enabled,
    queryFn: async (): Promise<MailboxMessage[]> => {
      const { data, error } = await supabase
        .from('mailbox_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MailboxMessage[];
    },
  });
}

export function useMailboxUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['mailbox', 'unread'],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('mailbox_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useSendMailboxMessage() {
  const qc = useQueryClient();
  const { leader, effectiveLeader } = useAuth();
  const sender = effectiveLeader ?? leader;
  return useMutation({
    mutationFn: async (input: { category: MailboxCategory; content: string; isAnonymous: boolean }) => {
      if (!sender?.id) throw new Error('Ingen leder');
      const { data, error } = await supabase
        .from('mailbox_messages')
        .insert({
          sender_leader_id: sender.id,
          category: input.category,
          content: input.content.trim(),
          is_anonymous: input.isAnonymous,
        })
        .select('id')
        .single();
      if (error) throw error;

      const preview = input.content.trim().slice(0, 90);
      try {
        await supabase.functions.invoke('push-admin-alert', {
          body: {
            title: '📬 Du har fått post!',
            message: `${categoryLabel(input.category)}: ${preview}${input.content.trim().length > 90 ? '…' : ''}`,
            url: '/postkasse',
            alert_type: 'mailbox_message',
            sender_name: input.isAnonymous ? 'Anonym' : sender.name,
          },
        });
      } catch (e) {
        console.error('Kunne ikke sende postkasse-varsling', e);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mailbox'] });
    },
  });
}

export function useUpdateMailboxMessage() {
  const qc = useQueryClient();
  const { leader, effectiveLeader } = useAuth();
  const me = effectiveLeader ?? leader;
  return useMutation({
    mutationFn: async (input: { id: string; status?: MailboxStatus; reply?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.status) {
        patch.status = input.status;
        if (input.status !== 'new') patch.read_at = new Date().toISOString();
      }
      if (typeof input.reply === 'string') {
        patch.admin_reply = input.reply.trim() || null;
        patch.replied_at = input.reply.trim() ? new Date().toISOString() : null;
        patch.replied_by = input.reply.trim() ? me?.id ?? null : null;
        if (input.reply.trim()) patch.status = 'replied';
      }
      const { error } = await supabase.from('mailbox_messages').update(patch).eq('id', input.id);
      if (error) throw error;

      if (typeof input.reply === 'string' && input.reply.trim()) {
        try {
          await supabase.functions.invoke('push-mailbox-reply', {
            body: { message_id: input.id },
          });
        } catch (e) {
          console.error('Kunne ikke sende svar-varsling', e);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mailbox'] });
    },
  });
}
