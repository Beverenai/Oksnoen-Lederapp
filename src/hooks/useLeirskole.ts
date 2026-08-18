import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type LeirskoleWeek = Tables<'leirskole_weeks'>;
export type LeirskolePost = Tables<'leirskole_posts'>;
export type LeirskoleStaff = Tables<'leirskole_staff'>;
export type LeirskoleAssignment = Tables<'leirskole_assignments'>;
export type LeirskoleActivityAssignment = Tables<'leirskole_activity_assignments'>;
export type LeirskoleActivityType = Tables<'leirskole_activity_types'>;
export type LeirskoleSessionActivities = Tables<'leirskole_session_activities'>;

/** Aktivitetstypene admin kan legge til / endre. */
export function useLeirskoleActivityTypes(onlyActive = false) {
  return useQuery({
    queryKey: ['leirskole-activity-types', onlyActive],
    queryFn: async () => {
      let q = supabase.from('leirskole_activity_types').select('*').order('sort_order');
      if (onlyActive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeirskoleActivityType[];
    },
  });
}

function slugifyActivity(label: string) {
  return label
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export function useAddLeirskoleActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      label,
      emoji,
      sortOrder,
    }: {
      label: string;
      emoji: string;
      sortOrder: number;
    }) => {
      const key = slugifyActivity(label) || `aktivitet_${Date.now()}`;
      const { error } = await supabase
        .from('leirskole_activity_types')
        .insert({ key, label: label.trim(), emoji: emoji || '•', sort_order: sortOrder });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-activity-types'] }),
  });
}

export function useUpdateLeirskoleActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<Pick<LeirskoleActivityType, 'label' | 'emoji' | 'is_active' | 'sort_order'>>) => {
      const { error } = await supabase.from('leirskole_activity_types').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-activity-types'] }),
  });
}

export function useDeleteLeirskoleActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_activity_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-activity-types'] }),
  });
}

/** Hvilke aktiviteter som er valgt per dag + økt i en uke. */
export function useLeirskoleSessionActivities(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-session-activities', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_session_activities')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return (data ?? []) as LeirskoleSessionActivities[];
    },
  });
}

export function useSaveLeirskoleSessionActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekId,
      date,
      session,
      activityKeys,
    }: {
      weekId: string;
      date: string;
      session: string;
      activityKeys: string[];
    }) => {
      const { error } = await supabase
        .from('leirskole_session_activities')
        .upsert(
          { week_id: weekId, date, session, activity_keys: activityKeys, updated_at: new Date().toISOString() },
          { onConflict: 'week_id,date,session' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-session-activities'] }),
  });
}

/** Alle leirskoleuker (kronologisk, eldste først). */
export function useLeirskoleWeeks() {
  return useQuery({
    queryKey: ['leirskole-weeks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_weeks')
        .select('*')
        .order('start_date', { ascending: true });
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
        .select('*, assignments:leirskole_assignments(id, staff_id, is_locked, assigned_manually, note)')
        .eq('week_id', weekId!)
        .order('date')
        .order('start_time');
      if (error) throw error;
      return (data ?? []) as (LeirskolePost & {
        assignments: { id: string; staff_id: string; is_locked: boolean; assigned_manually: boolean; note: string | null }[];
      })[];
    },
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
        .select('id, note, post:leirskole_posts(*)')
        .eq('staff_id', staff.id);
      if (error) throw error;
      const assignments = (data ?? []) as Array<{ note: string | null; post: LeirskolePost | null }>;
      return assignments
        .flatMap((assignment) =>
          assignment.post ? [{ ...assignment.post, leaderNote: assignment.note }] : [],
        )
        // Upubliserte økter (f.eks. 3. økt som settes senere på dagen) vises ikke.
        .filter((post) => (post as LeirskolePost & { is_published?: boolean }).is_published !== false)
        .sort((a, b) =>
          a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date),
        );
    },
  });
}

/**
 * Egen beskjed til én leder på én økt («ta med regntøy», «du leder gruppa» …).
 * Lagres på selve vakttildelingen, så lederen ser den på vakten sin.
 */
export function useSetLeirskoleAssignmentNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, note }: { assignmentId: string; note: string | null }) => {
      const { error } = await supabase
        .from('leirskole_assignments')
        .update({ note: note && note.trim() ? note.trim() : null })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
      qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
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

/**
 * Sett (eller fjern) aktiviteten til én leder i én økt. Erstatter det som
 * ligger der fra før for den lederen — brukes i dagsvisningen.
 */
export function useSetLeirskoleLeaderActivity() {
  const qc = useQueryClient();
  const { leader } = useAuth();
  return useMutation({
    mutationFn: async ({
      weekId,
      date,
      session,
      leaderId,
      activity,
      note,
    }: {
      weekId: string;
      date: string;
      session: string;
      leaderId: string;
      /** null fjerner aktiviteten. */
      activity: string | null;
      note?: string | null;
    }) => {
      const { error: delError } = await supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', weekId)
        .eq('date', date)
        .eq('session', session)
        .eq('leader_id', leaderId);
      if (delError) throw delError;
      if (!activity) return;
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: weekId,
        date,
        session,
        leader_id: leaderId,
        activity,
        note: note ?? null,
        auto_generated: false,
        created_by: leader?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateActivities(qc),
  });
}

export type LeirskoleWeekPlanCell = Tables<'leirskole_week_plan_cells'>;
export type LeirskoleWeekDay = Tables<'leirskole_week_days'>;

/** Dagtyper for uken (vanlig dag vs. avreisedag). */
export function useLeirskoleWeekDays(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-week-days', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_week_days')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return (data ?? []) as LeirskoleWeekDay[];
    },
  });
}

/** Marker en dag som avreisedag eller vanlig dag. */
export function useSetLeirskoleDayType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekId,
      date,
      dayType,
    }: {
      weekId: string;
      date: string;
      dayType: 'normal' | 'arrival' | 'departure' | 'both';
    }) => {
      const { error } = await supabase
        .from('leirskole_week_days')
        .upsert(
          { week_id: weekId, date, day_type: dayType, updated_at: new Date().toISOString() },
          { onConflict: 'week_id,date' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-week-days'] }),
  });
}

/** Lås/åpne en dag: låste dager røres ikke av vaktplan-generatoren. */
export function useSetLeirskoleDayLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ weekId, date, locked }: { weekId: string; date: string; locked: boolean }) => {
      const { error } = await supabase
        .from('leirskole_week_days')
        .upsert(
          { week_id: weekId, date, is_locked: locked, updated_at: new Date().toISOString() },
          { onConflict: 'week_id,date' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-week-days'] }),
  });
}

/** Logg for dagen: hvordan øktene faktisk gikk. */
export function useSetLeirskoleDayLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ weekId, date, note }: { weekId: string; date: string; note: string }) => {
      const { error } = await supabase
        .from('leirskole_week_days')
        .upsert(
          { week_id: weekId, date, log_note: note.trim() || null, updated_at: new Date().toISOString() },
          { onConflict: 'week_id,date' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-week-days'] }),
  });
}

/** Rutene i ukeplanleggeren (dag × rad). */
export type LeirskoleKitchenDay = Tables<'leirskole_kitchen_days'>;

/** Ledere som har kjøkken hele dagen (og dermed ingen andre vakter den dagen). */
export function useLeirskoleKitchenDays(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-kitchen-days', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_kitchen_days')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return (data ?? []) as LeirskoleKitchenDay[];
    },
  });
}

/** Sett/fjern kjøkkendag for en leder. Fjerner også vaktene deres den dagen. */
export function useSetLeirskoleKitchenDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekId,
      staffId,
      date,
      active,
    }: {
      weekId: string;
      staffId: string;
      date: string;
      active: boolean;
    }) => {
      if (!active) {
        const { error } = await supabase
          .from('leirskole_kitchen_days')
          .delete()
          .eq('staff_id', staffId)
          .eq('date', date);
        if (error) throw error;
        return;
      }
      // Kun én leder på kjøkken per dag — bytt ut den som eventuelt står der.
      await supabase
        .from('leirskole_kitchen_days')
        .delete()
        .eq('week_id', weekId)
        .eq('date', date)
        .neq('staff_id', staffId);

      const { error } = await supabase
        .from('leirskole_kitchen_days')
        .upsert({ week_id: weekId, staff_id: staffId, date }, { onConflict: 'staff_id,date' });
      if (error) throw error;

      // Kjøkkenledere skal ikke stå på andre vakter den dagen.
      const { data: posts } = await supabase
        .from('leirskole_posts')
        .select('id')
        .eq('week_id', weekId)
        .eq('date', date);
      const postIds = (posts ?? []).map((p) => p.id);
      if (postIds.length) {
        await supabase
          .from('leirskole_assignments')
          .delete()
          .eq('staff_id', staffId)
          .in('post_id', postIds);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-kitchen-days'] });
      qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
      qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
    },
  });
}

export function useLeirskoleWeekPlan(weekId?: string | null) {
  return useQuery({
    queryKey: ['leirskole-week-plan', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_week_plan_cells')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return (data ?? []) as LeirskoleWeekPlanCell[];
    },
  });
}

export function useSaveLeirskoleWeekPlanCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekId,
      date,
      rowIndex,
      content,
      color,
      postId,
    }: {
      weekId: string;
      date: string;
      rowIndex: number | null;
      content: string;
      color: string;
      postId?: string | null;
    }) => {
      if (postId) {
        const { error } = await supabase
          .from('leirskole_week_plan_cells')
          .upsert(
            {
              week_id: weekId,
              date,
              post_id: postId,
              row_index: null,
              content,
              color,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'week_id,date,post_id' },
          );
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('leirskole_week_plan_cells')
        .upsert(
          { week_id: weekId, date, row_index: rowIndex!, content, color, updated_at: new Date().toISOString() },
          { onConflict: 'week_id,date,row_index' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leirskole-week-plan'] }),
  });
}

/** Slett en vakt/økt. */
export function useDeleteLeirskolePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(qc),
  });
}

function invalidateSchedule(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
  qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
}

/** Legg til en egendefinert vakt/økt på en dag. */
export function useAddLeirskolePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      weekId: string;
      date: string;
      name: string;
      postType: 'meal' | 'main_shift' | 'night' | 'other';
      startTime: string;
      endTime: string;
      requiredLeaders: number;
      isPublished?: boolean;
    }) => {
      const { error } = await supabase.from('leirskole_posts').insert({
        week_id: row.weekId,
        date: row.date,
        name: row.name.trim(),
        post_type: row.postType,
        start_time: row.startTime,
        end_time: row.endTime,
        required_leaders: Math.max(1, row.requiredLeaders),
        is_main_shift: row.postType === 'main_shift',
        is_night: row.postType === 'night',
        is_custom: true,
        is_published: row.isPublished ?? true,
        sort_order: Number(row.startTime.slice(0, 2)) * 60 + Number(row.startTime.slice(3, 5)),
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(qc),
  });
}

/** Endre en vakt (tider, navn, bemanning, publisert). */
export function useUpdateLeirskolePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<
      Pick<LeirskolePost, 'name' | 'start_time' | 'end_time' | 'required_leaders' | 'is_published' | 'notes'>
    >) => {
      const { error } = await supabase.from('leirskole_posts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(qc),
  });
}

function shiftClock(value: string, minutes: number) {
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  let total = (h * 60 + m + minutes) % 1440;
  if (total < 0) total += 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Forskyv alle vaktene en dag (eller hele uken) med X minutter. */
export function useShiftLeirskolePosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekId,
      date,
      minutes,
    }: {
      weekId: string;
      /** null = hele uken */
      date: string | null;
      minutes: number;
    }) => {
      let q = supabase.from('leirskole_posts').select('id, start_time, end_time').eq('week_id', weekId);
      if (date) q = q.eq('date', date);
      const { data, error } = await q;
      if (error) throw error;
      for (const post of data ?? []) {
        const { error: upErr } = await supabase
          .from('leirskole_posts')
          .update({
            start_time: shiftClock(post.start_time, minutes),
            end_time: shiftClock(post.end_time, minutes),
          })
          .eq('id', post.id);
        if (upErr) throw upErr;
      }
      return (data ?? []).length;
    },
    onSuccess: () => invalidateSchedule(qc),
  });
}
