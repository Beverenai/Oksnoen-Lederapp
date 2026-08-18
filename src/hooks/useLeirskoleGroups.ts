import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type LeirskoleGroupCompletion = Tables<'leirskole_group_completions'>;
export type LeirskoleGroupRequirement = Tables<'leirskole_group_requirements'>;

/** Aktivitetene alle elevgruppene skal gjennom, og hvor mange ganger. */
export function useLeirskoleGroupRequirements() {
  return useQuery({
    queryKey: ['leirskole-group-requirements'],
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_group_requirements')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as LeirskoleGroupRequirement[];
    },
  });
}

export function useSetLeirskoleGroupRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      activityKey,
      requiredCount,
      sortOrder,
    }: {
      activityKey: string;
      /** 0 fjerner kravet. */
      requiredCount: number;
      sortOrder?: number;
    }) => {
      if (requiredCount <= 0) {
        const { error } = await supabase
          .from('leirskole_group_requirements')
          .delete()
          .eq('activity_key', activityKey);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('leirskole_group_requirements').upsert(
        { activity_key: activityKey, required_count: requiredCount, sort_order: sortOrder ?? 99 },
        { onConflict: 'activity_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-group-requirements'] }),
  });
}

/** Alt gruppene har gjennomført i en uke. */
export function useLeirskoleGroupCompletions(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-group-completions', weekId],
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_group_completions')
        .select('*')
        .eq('week_id', weekId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as LeirskoleGroupCompletion[];
    },
  });
}

export function useAddLeirskoleGroupCompletion() {
  const qc = useQueryClient();
  const { leader } = useAuth();
  return useMutation({
    mutationFn: async ({
      weekId,
      groupNumber,
      activityKey,
      date,
      session,
      note,
    }: {
      weekId: string;
      groupNumber: number;
      activityKey: string;
      date?: string | null;
      session?: string | null;
      note?: string | null;
    }) => {
      const { error } = await supabase.from('leirskole_group_completions').insert({
        week_id: weekId,
        group_number: groupNumber,
        activity_key: activityKey,
        date: date ?? null,
        session: session ?? null,
        note: note ?? null,
        created_by: leader?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-group-completions'] }),
  });
}

export function useDeleteLeirskoleGroupCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_group_completions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-group-completions'] }),
  });
}

/** Hvor mange elevgrupper som er på plass denne uken. */
export function useSetLeirskoleGroupCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ weekId, groupCount }: { weekId: string; groupCount: number }) => {
      const { error } = await supabase
        .from('leirskole_weeks')
        .update({ group_count: Math.max(0, Math.min(20, groupCount)) })
        .eq('id', weekId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-weeks'] });
      qc.invalidateQueries({ queryKey: ['leirskole-active-week'] });
    },
  });
}
