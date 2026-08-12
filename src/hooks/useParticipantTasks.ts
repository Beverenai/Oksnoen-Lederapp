import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ParticipantTask {
  id: string;
  participant_id: string;
  period_id: string | null;
  message: string;
  created_by: string | null;
  target_leader_id: string | null;
  is_broadcast: boolean;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  read_by: string | null;
  read_at: string | null;
  completed_at: string | null;
  created_at: string;
  participant?: {
    id: string;
    name: string;
    image_url: string | null;
    image_thumb_url: string | null;
  } | null;
  target_leader?: { id: string; name: string } | null;
  claimer?: { id: string; name: string } | null;
  creator?: { id: string; name: string } | null;
}

const SELECT =
  '*, participant:participants(id, name, image_url, image_thumb_url), target_leader:leaders!participant_tasks_target_leader_id_fkey(id, name), claimer:leaders!participant_tasks_claimed_by_fkey(id, name), creator:leaders!participant_tasks_created_by_fkey(id, name)';

/** Realtime — sørger for at kort forsvinner hos alle andre straks noen tar oppdraget */
export function useParticipantTasksRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('participant-tasks-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participant_tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['participant-tasks'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/** Oppdrag som skal vises på min hjemskjerm */
export function useMyParticipantTasks() {
  const { leader, effectiveLeader } = useAuth();
  const leaderId = effectiveLeader?.id ?? leader?.id ?? null;

  return useQuery({
    queryKey: ['participant-tasks', 'mine', leaderId],
    enabled: !!leaderId,
    staleTime: 15_000,
    queryFn: async (): Promise<ParticipantTask[]> => {
      const { data, error } = await (supabase as any)
        .from('participant_tasks')
        .select(SELECT)
        .in('status', ['open', 'claimed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as ParticipantTask[];
      return rows.filter((t) => {
        if (t.is_broadcast) return !t.claimed_by || t.claimed_by === leaderId;
        return t.target_leader_id === leaderId && !t.read_at;
      });
    },
  });
}

/** Alle oppdrag (kun admin får rader pga RLS) */
export function useAllParticipantTasks(enabled = true) {
  return useQuery({
    queryKey: ['participant-tasks', 'all'],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<ParticipantTask[]> => {
      const { data, error } = await (supabase as any)
        .from('participant_tasks')
        .select(SELECT)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ParticipantTask[];
    },
  });
}

export function useCreateParticipantTask() {
  const qc = useQueryClient();
  const { leader, effectiveLeader } = useAuth();
  const senderId = effectiveLeader?.id ?? leader?.id ?? null;

  return useMutation({
    mutationFn: async (input: {
      participantId: string;
      participantName: string;
      message: string;
      targetLeaderId: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from('participant_tasks')
        .insert({
          participant_id: input.participantId,
          message: input.message,
          created_by: senderId,
          target_leader_id: input.targetLeaderId,
          is_broadcast: !input.targetLeaderId,
        })
        .select('id')
        .single();
      if (error) throw error;

      try {
        await supabase.functions.invoke('push-participant-task', {
          body: {
            task_id: data.id,
            participant_name: input.participantName,
            message: input.message,
            target_leader_id: input.targetLeaderId,
          },
        });
      } catch (e) {
        console.error('push-participant-task failed', e);
      }
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-tasks'] }),
  });
}

export function useMarkParticipantTaskRead() {
  const qc = useQueryClient();
  const { leader, effectiveLeader } = useAuth();
  const leaderId = effectiveLeader?.id ?? leader?.id ?? null;

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase as any)
        .from('participant_tasks')
        .update({ read_at: new Date().toISOString(), read_by: leaderId, status: 'done', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-tasks'] }),
  });
}

export function useClaimParticipantTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await (supabase as any).rpc('claim_participant_task', { _task_id: taskId });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-tasks'] }),
  });
}

export function useCompleteParticipantTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase as any)
        .from('participant_tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-tasks'] }),
  });
}

export function useDeleteParticipantTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase as any).from('participant_tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-tasks'] }),
  });
}