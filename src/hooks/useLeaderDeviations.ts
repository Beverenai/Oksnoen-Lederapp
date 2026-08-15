import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type DeviationKind = 'overtime' | 'extra_hours' | 'missing_hours' | 'absence' | 'other';

export const DEVIATION_LABELS: Record<DeviationKind, string> = {
  overtime: 'Overtid',
  extra_hours: 'Ekstra timer',
  missing_hours: 'Manglende timer',
  absence: 'Fravær',
  other: 'Annet',
};

export const DEVIATION_COLORS: Record<DeviationKind, string> = {
  overtime: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  extra_hours: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  missing_hours: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  absence: 'bg-red-500/15 text-red-600 dark:text-red-400',
  other: 'bg-muted text-muted-foreground',
};

export interface LeaderDeviation {
  id: string;
  leader_id: string;
  period_id: string | null;
  kind: DeviationKind;
  hours: number | null;
  occurred_on: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  leader?: { id: string; name: string; profile_image_url: string | null } | null;
  creator?: { id: string; name: string } | null;
}

const SELECT =
  '*, leader:leaders!leader_deviations_leader_id_fkey(id, name, profile_image_url), creator:leaders!leader_deviations_created_by_fkey(id, name)';

export function useLeaderDeviations(enabled = true, limit = 100) {
  return useQuery({
    queryKey: ['leader-deviations', limit],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<LeaderDeviation[]> => {
      const { data, error } = await (supabase as any)
        .from('leader_deviations')
        .select(SELECT)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as LeaderDeviation[];
    },
  });
}

export function useCreateLeaderDeviation() {
  const qc = useQueryClient();
  const { leader, effectiveLeader } = useAuth();
  const createdBy = effectiveLeader?.id ?? leader?.id ?? null;

  return useMutation({
    mutationFn: async (input: {
      leaderId: string;
      kind: DeviationKind;
      hours: number | null;
      occurredOn: string;
      note: string | null;
    }) => {
      const { error } = await (supabase as any).from('leader_deviations').insert({
        leader_id: input.leaderId,
        kind: input.kind,
        hours: input.hours,
        occurred_on: input.occurredOn,
        note: input.note,
        created_by: createdBy,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leader-deviations'] }),
  });
}

export function useDeleteLeaderDeviation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('leader_deviations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leader-deviations'] }),
  });
}

export function useUpdateLeaderDeviation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      leaderId: string;
      kind: DeviationKind;
      hours: number | null;
      occurredOn: string;
      note: string | null;
    }) => {
      const { error } = await (supabase as any)
        .from('leader_deviations')
        .update({
          leader_id: input.leaderId,
          kind: input.kind,
          hours: input.hours,
          occurred_on: input.occurredOn,
          note: input.note,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leader-deviations'] }),
  });
}

function _unusedDeleteLeaderDeviation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('leader_deviations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leader-deviations'] }),
  });
}
