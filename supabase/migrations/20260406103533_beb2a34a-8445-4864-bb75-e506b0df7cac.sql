
-- 1. Health tables: remove cabin leader access from SELECT (admin/nurse only)

DROP POLICY IF EXISTS "health_events_select" ON public.participant_health_events;
CREATE POLICY "health_events_select" ON public.participant_health_events
  FOR SELECT TO authenticated
  USING (is_admin() OR is_nurse());

DROP POLICY IF EXISTS "health_info_select" ON public.participant_health_info;
CREATE POLICY "health_info_select" ON public.participant_health_info
  FOR SELECT TO authenticated
  USING (is_admin() OR is_nurse());

DROP POLICY IF EXISTS "health_notes_select" ON public.participant_health_notes;
CREATE POLICY "health_notes_select" ON public.participant_health_notes
  FOR SELECT TO authenticated
  USING (is_admin() OR is_nurse());

-- 2. cabin_reports: restrict INSERT and UPDATE to assigned cabin leaders or admin

DROP POLICY IF EXISTS "cabin_reports_insert" ON public.cabin_reports;
CREATE POLICY "cabin_reports_insert" ON public.cabin_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.leader_cabins
      WHERE leader_id = current_leader_id() AND cabin_id = cabin_reports.cabin_id
    )
  );

DROP POLICY IF EXISTS "cabin_reports_update" ON public.cabin_reports;
CREATE POLICY "cabin_reports_update" ON public.cabin_reports
  FOR UPDATE TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.leader_cabins
      WHERE leader_id = current_leader_id() AND cabin_id = cabin_reports.cabin_id
    )
  );

-- 3. fix_tasks: restrict UPDATE to admin only

DROP POLICY IF EXISTS "fix_tasks_update" ON public.fix_tasks;
CREATE POLICY "fix_tasks_update" ON public.fix_tasks
  FOR UPDATE TO authenticated
  USING (is_admin());

-- 4. rope_controls: restrict UPDATE to own rows or admin

DROP POLICY IF EXISTS "rope_controls_update" ON public.rope_controls;
CREATE POLICY "rope_controls_update" ON public.rope_controls
  FOR UPDATE TO authenticated
  USING ((leader_id = current_leader_id()) OR is_admin());
