import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import type { Tables } from '@/integrations/supabase/types';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

export type RouletteTask = Tables<'roulette_tasks'>;
export type RouletteAssignment = Tables<'roulette_assignments'>;
export type RouletteCategory = 'senior' | 'u18' | 'both';

// A leader is U18 if they're in team1f or team2f
export function useIsU18(leaderId: string | undefined | null) {
  return useQuery({
    queryKey: ['leader-is-u18', leaderId],
    enabled: !!leaderId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_teams')
        .select('team')
        .eq('leader_id', leaderId!);
      if (error) throw error;
      return (data ?? []).some(r => r.team === 'team1f' || r.team === 'team2f');
    },
  });
}

export function useRouletteTasks() {
  return useQuery({
    queryKey: ['roulette-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roulette_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RouletteTask[];
    },
  });
}

export function useCurrentAssignment(leaderId: string | undefined | null) {
  const qc = useQueryClient();
  const { data: activePeriodId } = useActivePeriodId();

  useEffect(() => {
    if (!leaderId) return;
    const ch = supabase
      .channel(uniqueRealtimeChannelName(`roulette-${leaderId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_assignments', filter: `leader_id=eq.${leaderId}` }, () => {
        qc.invalidateQueries({ queryKey: ['current-roulette-assignment', leaderId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['roulette-tasks'] });
        qc.invalidateQueries({ queryKey: ['current-roulette-assignment', leaderId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leaderId, qc]);

  return useQuery({
    queryKey: ['current-roulette-assignment', leaderId, activePeriodId],
    enabled: !!leaderId && !!activePeriodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roulette_assignments')
        .select('*, task:roulette_tasks(*)')
        .eq('leader_id', leaderId!)
        .eq('period_id', activePeriodId!)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data as (RouletteAssignment & { task: RouletteTask }) | null;
    },
  });
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useDrawRouletteTask() {
  const qc = useQueryClient();
  const { effectiveLeader } = useAuth();
  const { data: activePeriodId } = useActivePeriodId();

  return useMutation({
    mutationFn: async ({ isU18 }: { isU18: boolean }) => {
      if (!effectiveLeader) throw new Error('Ingen leder');
      if (!activePeriodId) throw new Error('Ingen aktiv periode');
      const category: 'senior' | 'u18' = isU18 ? 'u18' : 'senior';

      // All active tasks matching category or 'both'
      const { data: tasks, error: tErr } = await supabase
        .from('roulette_tasks')
        .select('*')
        .eq('is_active', true)
        .in('category', [category, 'both']);
      if (tErr) throw tErr;

      if (!tasks || tasks.length === 0) {
        throw new Error('Ingen oppgaver tilgjengelig akkurat nå');
      }

      // Try to avoid recently completed tasks
      const { data: prev } = await supabase
        .from('roulette_assignments')
        .select('task_id')
        .eq('leader_id', effectiveLeader.id)
        .eq('period_id', activePeriodId)
        .in('status', ['completed', 'skipped']);
      const seen = new Set((prev ?? []).map(r => r.task_id));
      const fresh = tasks.filter(t => !seen.has(t.id));
      const pool = fresh.length > 0 ? fresh : tasks;
      const chosen = pickRandom(pool)!;

      const { data: inserted, error: iErr } = await supabase
        .from('roulette_assignments')
        .insert({ leader_id: effectiveLeader.id, task_id: chosen.id, status: 'active', period_id: activePeriodId })
        .select('*, task:roulette_tasks(*)')
        .single();
      if (iErr) throw iErr;
      return inserted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-roulette-assignment', effectiveLeader?.id] });
    },
  });
}

export function useCompleteAssignment() {
  const qc = useQueryClient();
  const { effectiveLeader } = useAuth();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('roulette_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-roulette-assignment', effectiveLeader?.id] });
    },
  });
}

export function useSkipAssignment() {
  const qc = useQueryClient();
  const { effectiveLeader } = useAuth();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('roulette_assignments')
        .update({ status: 'skipped' })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-roulette-assignment', effectiveLeader?.id] });
    },
  });
}

export function useUpsertTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<RouletteTask> & { title: string }) => {
      if (task.id) {
        const { error } = await supabase.from('roulette_tasks').update({
          title: task.title,
          description: task.description ?? null,
          category: task.category ?? 'both',
          is_active: task.is_active ?? true,
        }).eq('id', task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('roulette_tasks').insert({
          title: task.title,
          description: task.description ?? null,
          category: task.category ?? 'both',
          is_active: task.is_active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roulette-tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roulette_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roulette-tasks'] }),
  });
}

export function useRouletteStats() {
  const { data: activePeriodId } = useActivePeriodId();
  return useQuery({
    queryKey: ['roulette-stats', activePeriodId],
    enabled: !!activePeriodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roulette_assignments')
        .select('id, status, completed_at, leader:leaders(name, profile_image_url), task:roulette_tasks(title)')
        .eq('period_id', activePeriodId!)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
