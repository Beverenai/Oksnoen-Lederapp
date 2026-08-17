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
export type LeirskoleActivityAssignment = Tables<'leirskole_activity_assignments'>;

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

/** Aktiv leirskoleuke — velges automatisk ut fra dagens dato. */
export function useActiveLeirskoleWeek() {
  return useQuery({
    queryKey: ['leirskole-active-week'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_weeks')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: true });
      if (error) throw error;
      const weeks = (data ?? []) as LeirskoleWeek[];
      if (!weeks.length) return null;
      const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD lokal tid
      // 1) uken vi er inne i, 2) neste uke som kommer, 3) siste uke som var
      return (
        weeks.find((w) => w.start_date <= today && w.end_date >= today) ??
        weeks.find((w) => w.start_date > today) ??
        weeks[weeks.length - 1]
      );
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
        .select('*, leader:leaders(id, name, profile_image_url, leirskole_competencies, phone, snus_user, snus_product_id, snus_custom_label)')
        .eq('week_id', weekId!);
      if (error) throw error;
      return (data ?? []) as (LeirskoleStaff & {
        leader: {
          id: string;
          name: string;
          profile_image_url: string | null;
          leirskole_competencies: string[] | null;
          phone?: string | null;
          snus_user?: boolean | null;
          snus_product_id?: string | null;
          snus_custom_label?: string | null;
        } | null;
      })[];
    },
  });
}

/** Min leirskole-kompetanse. */
export function useMyLeirskoleCompetencies() {
  const { effectiveLeader } = useAuth();
  return useQuery({
    queryKey: ['leirskole-competencies', effectiveLeader?.id],
    enabled: !!effectiveLeader?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('leirskole_competencies, leirskole_competencies_confirmed_at')
        .eq('id', effectiveLeader!.id)
        .maybeSingle();
      if (error) throw error;
      const list = (data?.leirskole_competencies ?? []) as string[];
      const confirmedAt = (data as { leirskole_competencies_confirmed_at?: string | null } | null)
        ?.leirskole_competencies_confirmed_at ?? null;
      return Object.assign(list, { confirmedAt }) as string[] & { confirmedAt: string | null };
    },
  });
}

/** Lagre kompetanse for en leder (seg selv eller admin på andre). */
export function useSaveLeirskoleCompetencies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leaderId,
      competencies,
      confirm,
    }: {
      leaderId: string;
      competencies: string[];
      /** Sett når lederen selv bekrefter (fjerner førstegangs-spørsmålet). */
      confirm?: boolean;
    }) => {
      const { error } = await supabase
        .from('leaders')
        .update({
          leirskole_competencies: competencies,
          ...(confirm ? { leirskole_competencies_confirmed_at: new Date().toISOString() } : {}),
        })
        .eq('id', leaderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-competencies'] });
      qc.invalidateQueries({ queryKey: ['leirskole-staff'] });
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
    enabled: !!weekId && !!effectiveLeader?.id,
    queryFn: async () => {
      const [{ data: tasks, error }, { data: done, error: doneError }] = await Promise.all([
        supabase.from('leirskole_tasks').select('*').eq('week_id', weekId!).order('created_at', { ascending: false }),
        supabase
          .from('leirskole_task_completions')
          .select('task_id, leader_id, completed_at')
          .eq('leader_id', effectiveLeader!.id),
      ]);
      if (error) throw error;
      if (doneError) throw doneError;
      const mine = new Set(
        (done ?? []).filter((completion) => completion.leader_id === effectiveLeader?.id).map((completion) => completion.task_id),
      );
      return (tasks ?? []).map((task) => ({
        ...(task as LeirskoleTask),
        completedByMe: mine.has(task.id),
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
      const assignments = (data ?? []) as Array<{ post: LeirskolePost | null }>;
      return assignments
        .map((assignment) => assignment.post)
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
      const response = data as {
        error?: string;
        status: string;
        stats: { assigned?: number; missing?: unknown[] };
      };
      if (response?.error) throw new Error(response.error);
      return response;
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

/**
 * Øktinfo for uken (hybrid av «Denne økten skal du» i vanlig app).
 * Returnerer bare det som gjelder meg, med lest-status.
 */
export function useLeirskoleSessionInfo(weekId?: string | null) {
  const { effectiveLeader } = useAuth();
  return useQuery({
    queryKey: ['leirskole-session-info', weekId, effectiveLeader?.id],
    enabled: !!weekId,
    queryFn: async () => {
      const [{ data: info, error }, { data: reads }] = await Promise.all([
        supabase
          .from('leirskole_session_info')
          .select('*')
          .eq('week_id', weekId!)
          .order('created_at', { ascending: false }),
        supabase.from('leirskole_session_info_reads').select('info_id, leader_id'),
      ]);
      if (error) throw error;
      const mineRead = new Set(
        (reads ?? []).filter((read) => read.leader_id === effectiveLeader?.id).map((read) => read.info_id),
      );
      return (info ?? []).map((entry) => ({
        ...(entry as LeirskoleSessionInfo),
        readByMe: mineRead.has(entry.id),
        readCount: (reads ?? []).filter((read) => read.info_id === entry.id).length,
      }));
    },
  });
}

export function useMarkLeirskoleInfoRead() {
  const qc = useQueryClient();
  const { effectiveLeader } = useAuth();
  return useMutation({
    mutationFn: async ({ infoId, read }: { infoId: string; read: boolean }) => {
      if (!effectiveLeader?.id) throw new Error('Ingen leder');
      if (read) {
        const { error } = await supabase
          .from('leirskole_session_info_reads')
          .insert({ info_id: infoId, leader_id: effectiveLeader.id });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_session_info_reads')
          .delete()
          .eq('info_id', infoId)
          .eq('leader_id', effectiveLeader.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-session-info'] }),
  });
}

/** Aktivitetstildelinger (Tube, Klatring …) for en uke. */
export function useLeirskoleActivities(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-activities', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_activity_assignments')
        .select('*')
        .eq('week_id', weekId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeirskoleActivityAssignment[];
    },
  });
}

/** Hele historikken (alle uker) — brukes til rettferdig fordeling. */
export function useLeirskoleActivityHistory() {
  return useQuery({
    queryKey: ['leirskole-activity-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_activity_assignments')
        .select('leader_id, activity, date, session, week_id');
      if (error) throw error;
      return (data ?? []) as Pick<
        LeirskoleActivityAssignment,
        'leader_id' | 'activity' | 'date' | 'session' | 'week_id'
      >[];
    },
  });
}

/** Mine aktiviteter i aktiv uke. */
export function useMyLeirskoleActivities(weekId?: string | null) {
  const { effectiveLeader } = useAuth();
  return useQuery({
    queryKey: ['leirskole-my-activities', weekId, effectiveLeader?.id],
    enabled: !!weekId && !!effectiveLeader?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_activity_assignments')
        .select('*')
        .eq('week_id', weekId!)
        .eq('leader_id', effectiveLeader!.id)
        .order('date');
      if (error) throw error;
      return (data ?? []) as LeirskoleActivityAssignment[];
    },
  });
}

function invalidateActivities(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['leirskole-activities'] });
  qc.invalidateQueries({ queryKey: ['leirskole-activity-history'] });
  qc.invalidateQueries({ queryKey: ['leirskole-my-activities'] });
}

export interface SaveActivityRow {
  leader_id: string;
  activity: string;
  note?: string | null;
  auto_generated?: boolean;
}

/** Lagre (erstatt) aktivitetene for en dato + økt. */
export function useSaveLeirskoleActivities() {
  const qc = useQueryClient();
  const { leader } = useAuth();
  return useMutation({
    mutationFn: async ({
      weekId,
      date,
      session,
      rows,
      replace = true,
    }: {
      weekId: string;
      date: string;
      session: string;
      rows: SaveActivityRow[];
      replace?: boolean;
    }) => {
      if (replace) {
        const { error: delError } = await supabase
          .from('leirskole_activity_assignments')
          .delete()
          .eq('week_id', weekId)
          .eq('date', date)
          .eq('session', session);
        if (delError) throw delError;
      }
      if (rows.length === 0) return [];
      const { data, error } = await supabase
        .from('leirskole_activity_assignments')
        .insert(
          rows.map((row) => ({
            week_id: weekId,
            date,
            session,
            leader_id: row.leader_id,
            activity: row.activity,
            note: row.note ?? null,
            auto_generated: row.auto_generated ?? false,
            created_by: leader?.id ?? null,
          })),
        )
        .select('id, leader_id');
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => invalidateActivities(qc),
  });
}

export function useDeleteLeirskoleActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_activity_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateActivities(qc),
  });
}
