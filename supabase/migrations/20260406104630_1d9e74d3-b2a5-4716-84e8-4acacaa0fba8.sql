
-- 1. Create get_my_roles() RPC function (SECURITY DEFINER, bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS TABLE(role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role FROM public.user_roles ur
  WHERE ur.leader_id = public.current_leader_id()
$$;

-- 2. Tighten SELECT policies: replace USING (true) with explicit auth check

-- leaders
DROP POLICY IF EXISTS "leaders_select" ON public.leaders;
CREATE POLICY "leaders_select" ON public.leaders
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- participants
DROP POLICY IF EXISTS "participants_select" ON public.participants;
CREATE POLICY "participants_select" ON public.participants
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- cabins
DROP POLICY IF EXISTS "cabins_select" ON public.cabins;
CREATE POLICY "cabins_select" ON public.cabins
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- activities
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- session_activities
DROP POLICY IF EXISTS "session_activities_select" ON public.session_activities;
CREATE POLICY "session_activities_select" ON public.session_activities
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- participant_activities
DROP POLICY IF EXISTS "part_activities_select" ON public.participant_activities;
CREATE POLICY "part_activities_select" ON public.participant_activities
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- cabin_reports
DROP POLICY IF EXISTS "cabin_reports_select" ON public.cabin_reports;
CREATE POLICY "cabin_reports_select" ON public.cabin_reports
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- announcements
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- home_screen_config
DROP POLICY IF EXISTS "home_config_select" ON public.home_screen_config;
CREATE POLICY "home_config_select" ON public.home_screen_config
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- app_config
DROP POLICY IF EXISTS "app_config_select" ON public.app_config;
CREATE POLICY "app_config_select" ON public.app_config
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- fix_tasks
DROP POLICY IF EXISTS "fix_tasks_select" ON public.fix_tasks;
CREATE POLICY "fix_tasks_select" ON public.fix_tasks
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- rope_controls
DROP POLICY IF EXISTS "rope_controls_select" ON public.rope_controls;
CREATE POLICY "rope_controls_select" ON public.rope_controls
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- leader_content
DROP POLICY IF EXISTS "leader_content_select" ON public.leader_content;
CREATE POLICY "leader_content_select" ON public.leader_content
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- stories
DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- leader_cabins
DROP POLICY IF EXISTS "leader_cabins_select" ON public.leader_cabins;
CREATE POLICY "leader_cabins_select" ON public.leader_cabins
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- room_swaps
DROP POLICY IF EXISTS "room_swaps_select" ON public.room_swaps;
CREATE POLICY "room_swaps_select" ON public.room_swaps
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- extra_fields_config
DROP POLICY IF EXISTS "extra_fields_select" ON public.extra_fields_config;
CREATE POLICY "extra_fields_select" ON public.extra_fields_config
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- room_capacity
DROP POLICY IF EXISTS "room_capacity_select" ON public.room_capacity;
CREATE POLICY "room_capacity_select" ON public.room_capacity
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- Also tighten write policies that still use USING/WITH CHECK (true)
-- participant_activities write policies
DROP POLICY IF EXISTS "part_activities_insert" ON public.participant_activities;
CREATE POLICY "part_activities_insert" ON public.participant_activities
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "part_activities_update" ON public.participant_activities;
CREATE POLICY "part_activities_update" ON public.participant_activities
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "part_activities_delete" ON public.participant_activities;
CREATE POLICY "part_activities_delete" ON public.participant_activities
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- participants update (was USING true)
DROP POLICY IF EXISTS "participants_update" ON public.participants;
CREATE POLICY "participants_update" ON public.participants
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

-- fix_tasks insert (was WITH CHECK true)
DROP POLICY IF EXISTS "fix_tasks_insert" ON public.fix_tasks;
CREATE POLICY "fix_tasks_insert" ON public.fix_tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- rope_controls insert (was WITH CHECK true)
DROP POLICY IF EXISTS "rope_controls_insert" ON public.rope_controls;
CREATE POLICY "rope_controls_insert" ON public.rope_controls
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');
