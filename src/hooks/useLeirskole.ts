import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type LeirskoleWeek = Tables<'leirskole_weeks'>;
export type LeirskolePost = Tables<'leirskole_posts'>;
export type LeirskoleStaff = Tables<'leirskole_staff'>;
export type LeirskoleAssignment = Tables<'leirskole_assignments'>;
export type LeirskoleTask = Tables<'leirskole_tasks'>;
export type LeirskoleSessionInfo = Tables<'leirskole_session_info'>;

/** Alle leirskoleuker (nyeste først). */
export function useLeirskoleWeeks() {
  return useQuery({
    queryKey: ['leirskole-weeks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_weeks')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeirskoleWeek[];
    },
  });
}

/** Aktiv leirskoleuke. */
export function useActiveLeirskoleWeek() {
  return useQuery({
    queryKey: ['leirskole-active-week'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_weeks')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as LeirskoleWeek | null) ?? null;
    },
  });
}

/** Ledere som er satt opp på en uke, med navn og bilde. */
export function useLeirskoleStaff(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-staff', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_staff')
        .select('*, leader:leaders(id, name, profile_image_url)')
        .eq('week_id', weekId!);
      if (error) throw error;
      return (data ?? []) as (LeirskoleStaff & {
        leader: { id: string; name: string; profile_image_url: string | null } | null;
      })[];
    },
  });
}

/** Vaktposter for en uke, inkludert hvem som er satt opp. */
export function useLeirskoleSchedule(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-schedule', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_posts')
        .select('*, assignments:leirskole_assignments(id, staff_id, is_locked, assigned_manually)')
        .eq('week_id', weekId!)
        .order('date')
        .order('start_time');
      if (error) throw error;
      return (data ?? []) as (LeirskolePost & {
        assignments: { id: string; staff_id: string; is_locked: boolean; assigned_manually: boolean }[];
      })[];
    },
  });
}

/** Oppgaver for uken + hvilke jeg har fullført. */
export function useLeirskoleTasks(weekId?: string | null) {
  const { effectiveLeader } = useAuth();
  return useQuery({
    queryKey: ['leirskole-tasks', weekId, effectiveLeader?.id],
    enabled: !!weekId,
    queryFn: async () => {
      const [{ data: tasks, error }, { data: done }] = await Promise.all([
        supabase.from('leirskole_tasks').select('*').eq('week_id', weekId!).order('created_at', { ascending: false }),
        supabase.from('leirskole_task_completions').select('task_id, leader_id, completed_at'),
      ]);
      if (error) throw error;
      const mine = new Set(
        (done ?? []).filter((d: any) => d.leader_id === effectiveLeader?.id).map((d: any) => d.task_id),
      );
      return (tasks ?? []).map((t: any) => ({
        ...(t as LeirskoleTask),
        completedByMe: mine.has(t.id),
        completedCount: (done ?? []).filter((d: any) => d.task_id === t.id).length,
      }));
    },
  });
}

export function useToggleLeirskoleTask() {
  const qc = useQueryClient();
  const { effectiveLeader } = useAuth();
  return useMutation({
    mutationFn: async ({ taskId, done }: { taskId: string; done: boolean }) => {
      if (!effectiveLeader?.id) throw new Error('Ingen leder');
      if (done) {
        const { error } = await supabase
          .from('leirskole_task_completions')
          .insert({ task_id: taskId, leader_id: effectiveLeader.id });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_task_completions')
          .delete()
          .eq('task_id', taskId)
          .eq('leader_id', effectiveLeader.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-tasks'] }),
  });
}

/** Mine leirskolevakter i aktiv uke. */
export function useMyLeirskoleShifts(weekId?: string | null) {
  const { effectiveLeader } = useAuth();
  return useQuery({
    queryKey: ['leirskole-my-shifts', weekId, effectiveLeader?.id],
    enabled: !!weekId && !!effectiveLeader?.id,
    queryFn: async () => {
      const { data: staff } = await supabase
        .from('leirskole_staff')
        .select('id')
        .eq('week_id', weekId!)
        .eq('leader_id', effectiveLeader!.id)
        .maybeSingle();
      if (!staff) return [];
      const { data, error } = await supabase
        .from('leirskole_assignments')
        .select('id, post:leirskole_posts(*)')
        .eq('staff_id', staff.id);
      if (error) throw error;
      return (data ?? [])
        .map((a: any) => a.post as LeirskolePost)
        .filter(Boolean)
        .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)));
    },
  });
}

/** Kjør vaktplan-generatoren for en uke (admin). */
export function useGenerateLeirskoleSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ weekId, keepLocked = true }: { weekId: string; keepLocked?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('generate-leirskole-schedule', {
        body: { week_id: weekId, keep_locked: keepLocked },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { status: string; stats: any };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
      qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
    },
  });
}

/**
 * Er jeg satt opp som staff på denne leirskoleuken?
 * Brukes til å begrense leirskole-chatten til de som faktisk er aktive.
 */
export function useIsLeirskoleStaff(weekId?: string | null) {
  const { effectiveLeader } = useAuth();
  return useQuery({
    queryKey: ['leirskole-is-staff', weekId, effectiveLeader?.id],
    enabled: !!weekId && !!effectiveLeader?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_staff')
        .select('id')
        .eq('week_id', weekId!)
        .eq('leader_id', effectiveLeader!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}
