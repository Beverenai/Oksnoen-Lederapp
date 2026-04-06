
-- 1. Add auth_user_id column to leaders
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

-- 2. Create helper functions
CREATE OR REPLACE FUNCTION public.current_leader_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.leaders WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.has_role(public.current_leader_id(), 'admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_nurse()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.has_role(public.current_leader_id(), 'nurse'), false)
$$;

-- 3. Drop ALL existing permissive policies

-- leaders
DROP POLICY IF EXISTS "Allow public delete" ON public.leaders;
DROP POLICY IF EXISTS "Allow public insert" ON public.leaders;
DROP POLICY IF EXISTS "Allow public read" ON public.leaders;
DROP POLICY IF EXISTS "Allow public update" ON public.leaders;

-- participants
DROP POLICY IF EXISTS "Allow public delete participants" ON public.participants;
DROP POLICY IF EXISTS "Allow public insert participants" ON public.participants;
DROP POLICY IF EXISTS "Allow public read participants" ON public.participants;
DROP POLICY IF EXISTS "Allow public update participants" ON public.participants;

-- activities
DROP POLICY IF EXISTS "Allow public delete activities" ON public.activities;
DROP POLICY IF EXISTS "Allow public insert activities" ON public.activities;
DROP POLICY IF EXISTS "Allow public read activities" ON public.activities;
DROP POLICY IF EXISTS "Allow public update activities" ON public.activities;

-- announcements
DROP POLICY IF EXISTS "Allow public delete" ON public.announcements;
DROP POLICY IF EXISTS "Allow public insert" ON public.announcements;
DROP POLICY IF EXISTS "Allow public read" ON public.announcements;
DROP POLICY IF EXISTS "Allow public update" ON public.announcements;

-- app_config
DROP POLICY IF EXISTS "Allow public delete" ON public.app_config;
DROP POLICY IF EXISTS "Allow public insert" ON public.app_config;
DROP POLICY IF EXISTS "Allow public read" ON public.app_config;
DROP POLICY IF EXISTS "Allow public update" ON public.app_config;

-- cabin_reports
DROP POLICY IF EXISTS "Allow public delete cabin_reports" ON public.cabin_reports;
DROP POLICY IF EXISTS "Allow public insert cabin_reports" ON public.cabin_reports;
DROP POLICY IF EXISTS "Allow public read cabin_reports" ON public.cabin_reports;
DROP POLICY IF EXISTS "Allow public update cabin_reports" ON public.cabin_reports;

-- cabins
DROP POLICY IF EXISTS "Allow public delete" ON public.cabins;
DROP POLICY IF EXISTS "Allow public insert" ON public.cabins;
DROP POLICY IF EXISTS "Allow public read" ON public.cabins;
DROP POLICY IF EXISTS "Allow public update" ON public.cabins;

-- extra_fields_config
DROP POLICY IF EXISTS "Allow public delete" ON public.extra_fields_config;
DROP POLICY IF EXISTS "Allow public insert" ON public.extra_fields_config;
DROP POLICY IF EXISTS "Allow public read" ON public.extra_fields_config;
DROP POLICY IF EXISTS "Allow public update" ON public.extra_fields_config;

-- fix_tasks
DROP POLICY IF EXISTS "Allow public delete fix_tasks" ON public.fix_tasks;
DROP POLICY IF EXISTS "Allow public insert fix_tasks" ON public.fix_tasks;
DROP POLICY IF EXISTS "Allow public read fix_tasks" ON public.fix_tasks;
DROP POLICY IF EXISTS "Allow public update fix_tasks" ON public.fix_tasks;

-- home_screen_config
DROP POLICY IF EXISTS "Allow public delete" ON public.home_screen_config;
DROP POLICY IF EXISTS "Allow public insert" ON public.home_screen_config;
DROP POLICY IF EXISTS "Allow public read" ON public.home_screen_config;
DROP POLICY IF EXISTS "Allow public update" ON public.home_screen_config;

-- leader_cabins
DROP POLICY IF EXISTS "Allow public delete leader_cabins" ON public.leader_cabins;
DROP POLICY IF EXISTS "Allow public insert leader_cabins" ON public.leader_cabins;
DROP POLICY IF EXISTS "Allow public read leader_cabins" ON public.leader_cabins;
DROP POLICY IF EXISTS "Allow public update leader_cabins" ON public.leader_cabins;

-- leader_content
DROP POLICY IF EXISTS "Allow public delete" ON public.leader_content;
DROP POLICY IF EXISTS "Allow public insert" ON public.leader_content;
DROP POLICY IF EXISTS "Allow public read" ON public.leader_content;
DROP POLICY IF EXISTS "Allow public update" ON public.leader_content;

-- participant_activities
DROP POLICY IF EXISTS "Allow public delete activities" ON public.participant_activities;
DROP POLICY IF EXISTS "Allow public insert activities" ON public.participant_activities;
DROP POLICY IF EXISTS "Allow public read activities" ON public.participant_activities;
DROP POLICY IF EXISTS "Allow public update activities" ON public.participant_activities;

-- participant_health_events
DROP POLICY IF EXISTS "Nurse and admin can delete health events" ON public.participant_health_events;
DROP POLICY IF EXISTS "Nurse and admin can insert health events" ON public.participant_health_events;
DROP POLICY IF EXISTS "Nurse and admin can read health events" ON public.participant_health_events;
DROP POLICY IF EXISTS "Nurse and admin can update health events" ON public.participant_health_events;

-- participant_health_info
DROP POLICY IF EXISTS "Allow public delete health info" ON public.participant_health_info;
DROP POLICY IF EXISTS "Allow public insert health info" ON public.participant_health_info;
DROP POLICY IF EXISTS "Allow public read health info" ON public.participant_health_info;
DROP POLICY IF EXISTS "Allow public update health info" ON public.participant_health_info;

-- participant_health_notes
DROP POLICY IF EXISTS "Nurse and admin can delete health notes" ON public.participant_health_notes;
DROP POLICY IF EXISTS "Nurse and admin can insert health notes" ON public.participant_health_notes;
DROP POLICY IF EXISTS "Nurse and admin can read health notes" ON public.participant_health_notes;
DROP POLICY IF EXISTS "Nurse and admin can update health notes" ON public.participant_health_notes;

-- push_subscriptions
DROP POLICY IF EXISTS "Leaders can delete own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Leaders can insert subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Leaders can update subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Leaders can view own subscriptions" ON public.push_subscriptions;

-- room_capacity
DROP POLICY IF EXISTS "Allow public delete room_capacity" ON public.room_capacity;
DROP POLICY IF EXISTS "Allow public insert room_capacity" ON public.room_capacity;
DROP POLICY IF EXISTS "Allow public read room_capacity" ON public.room_capacity;
DROP POLICY IF EXISTS "Allow public update room_capacity" ON public.room_capacity;

-- room_swaps
DROP POLICY IF EXISTS "Allow public delete room_swaps" ON public.room_swaps;
DROP POLICY IF EXISTS "Allow public insert room_swaps" ON public.room_swaps;
DROP POLICY IF EXISTS "Allow public read room_swaps" ON public.room_swaps;
DROP POLICY IF EXISTS "Allow public update room_swaps" ON public.room_swaps;

-- rope_controls
DROP POLICY IF EXISTS "Allow public delete rope_controls" ON public.rope_controls;
DROP POLICY IF EXISTS "Allow public insert rope_controls" ON public.rope_controls;
DROP POLICY IF EXISTS "Allow public read rope_controls" ON public.rope_controls;
DROP POLICY IF EXISTS "Allow public update rope_controls" ON public.rope_controls;

-- session_activities
DROP POLICY IF EXISTS "Allow public delete" ON public.session_activities;
DROP POLICY IF EXISTS "Allow public insert" ON public.session_activities;
DROP POLICY IF EXISTS "Allow public read" ON public.session_activities;
DROP POLICY IF EXISTS "Allow public update" ON public.session_activities;

-- stories
DROP POLICY IF EXISTS "Allow public delete stories" ON public.stories;
DROP POLICY IF EXISTS "Allow public insert stories" ON public.stories;
DROP POLICY IF EXISTS "Allow public read stories" ON public.stories;
DROP POLICY IF EXISTS "Allow public update stories" ON public.stories;

-- user_roles
DROP POLICY IF EXISTS "Allow public delete" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public insert" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public read" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public update" ON public.user_roles;

-- 4. Create new proper RLS policies

-- leaders: any authenticated can read, admin can insert/delete, own row or admin can update
CREATE POLICY "leaders_select" ON public.leaders FOR SELECT TO authenticated USING (true);
CREATE POLICY "leaders_insert" ON public.leaders FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "leaders_update" ON public.leaders FOR UPDATE TO authenticated USING (id = public.current_leader_id() OR public.is_admin());
CREATE POLICY "leaders_delete" ON public.leaders FOR DELETE TO authenticated USING (public.is_admin());

-- participants: authenticated can read/update, admin can insert/delete
CREATE POLICY "participants_select" ON public.participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "participants_insert" ON public.participants FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "participants_update" ON public.participants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "participants_delete" ON public.participants FOR DELETE TO authenticated USING (public.is_admin());

-- participant_health_info: admin, nurse, or assigned cabin leader
CREATE POLICY "health_info_select" ON public.participant_health_info FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_nurse() OR EXISTS (
  SELECT 1 FROM public.leader_cabins lc JOIN public.participants p ON p.cabin_id = lc.cabin_id
  WHERE lc.leader_id = public.current_leader_id() AND p.id = participant_health_info.participant_id
));
CREATE POLICY "health_info_insert" ON public.participant_health_info FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_nurse());
CREATE POLICY "health_info_update" ON public.participant_health_info FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_nurse());
CREATE POLICY "health_info_delete" ON public.participant_health_info FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_nurse());

-- participant_health_events: admin, nurse, or assigned cabin leader can read; admin/nurse can write
CREATE POLICY "health_events_select" ON public.participant_health_events FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_nurse() OR EXISTS (
  SELECT 1 FROM public.leader_cabins lc JOIN public.participants p ON p.cabin_id = lc.cabin_id
  WHERE lc.leader_id = public.current_leader_id() AND p.id = participant_health_events.participant_id
));
CREATE POLICY "health_events_insert" ON public.participant_health_events FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_nurse());
CREATE POLICY "health_events_update" ON public.participant_health_events FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_nurse());
CREATE POLICY "health_events_delete" ON public.participant_health_events FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_nurse());

-- participant_health_notes: admin, nurse, or assigned cabin leader can read; admin/nurse can write
CREATE POLICY "health_notes_select" ON public.participant_health_notes FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_nurse() OR EXISTS (
  SELECT 1 FROM public.leader_cabins lc JOIN public.participants p ON p.cabin_id = lc.cabin_id
  WHERE lc.leader_id = public.current_leader_id() AND p.id = participant_health_notes.participant_id
));
CREATE POLICY "health_notes_insert" ON public.participant_health_notes FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_nurse());
CREATE POLICY "health_notes_update" ON public.participant_health_notes FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_nurse());
CREATE POLICY "health_notes_delete" ON public.participant_health_notes FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_nurse());

-- user_roles: admin can read all, others can read own; NO client writes
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
USING (public.is_admin() OR leader_id = public.current_leader_id());

-- activities: authenticated read, admin write
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "activities_update" ON public.activities FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "activities_delete" ON public.activities FOR DELETE TO authenticated USING (public.is_admin());

-- participant_activities: all authenticated
CREATE POLICY "part_activities_select" ON public.participant_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "part_activities_insert" ON public.participant_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "part_activities_update" ON public.participant_activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "part_activities_delete" ON public.participant_activities FOR DELETE TO authenticated USING (true);

-- announcements: authenticated read, admin write
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE TO authenticated USING (public.is_admin());

-- app_config: authenticated read, admin write
CREATE POLICY "app_config_select" ON public.app_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_config_insert" ON public.app_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "app_config_update" ON public.app_config FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "app_config_delete" ON public.app_config FOR DELETE TO authenticated USING (public.is_admin());

-- cabins: authenticated read, admin write
CREATE POLICY "cabins_select" ON public.cabins FOR SELECT TO authenticated USING (true);
CREATE POLICY "cabins_insert" ON public.cabins FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "cabins_update" ON public.cabins FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "cabins_delete" ON public.cabins FOR DELETE TO authenticated USING (public.is_admin());

-- cabin_reports: authenticated read/insert/update, admin delete
CREATE POLICY "cabin_reports_select" ON public.cabin_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "cabin_reports_insert" ON public.cabin_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cabin_reports_update" ON public.cabin_reports FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cabin_reports_delete" ON public.cabin_reports FOR DELETE TO authenticated USING (public.is_admin());

-- leader_cabins: authenticated read, admin write
CREATE POLICY "leader_cabins_select" ON public.leader_cabins FOR SELECT TO authenticated USING (true);
CREATE POLICY "leader_cabins_insert" ON public.leader_cabins FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "leader_cabins_update" ON public.leader_cabins FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "leader_cabins_delete" ON public.leader_cabins FOR DELETE TO authenticated USING (public.is_admin());

-- leader_content: authenticated read, own insert/update, admin can also update
CREATE POLICY "leader_content_select" ON public.leader_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "leader_content_insert" ON public.leader_content FOR INSERT TO authenticated WITH CHECK (leader_id = public.current_leader_id() OR public.is_admin());
CREATE POLICY "leader_content_update" ON public.leader_content FOR UPDATE TO authenticated USING (leader_id = public.current_leader_id() OR public.is_admin());
CREATE POLICY "leader_content_delete" ON public.leader_content FOR DELETE TO authenticated USING (public.is_admin());

-- fix_tasks: authenticated read/insert/update, admin delete
CREATE POLICY "fix_tasks_select" ON public.fix_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "fix_tasks_insert" ON public.fix_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fix_tasks_update" ON public.fix_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fix_tasks_delete" ON public.fix_tasks FOR DELETE TO authenticated USING (public.is_admin());

-- rope_controls: authenticated read/insert/update, admin delete
CREATE POLICY "rope_controls_select" ON public.rope_controls FOR SELECT TO authenticated USING (true);
CREATE POLICY "rope_controls_insert" ON public.rope_controls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rope_controls_update" ON public.rope_controls FOR UPDATE TO authenticated USING (true);
CREATE POLICY "rope_controls_delete" ON public.rope_controls FOR DELETE TO authenticated USING (public.is_admin());

-- stories: authenticated read, admin write
CREATE POLICY "stories_select" ON public.stories FOR SELECT TO authenticated USING (true);
CREATE POLICY "stories_insert" ON public.stories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "stories_update" ON public.stories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "stories_delete" ON public.stories FOR DELETE TO authenticated USING (public.is_admin());

-- push_subscriptions: own rows only
CREATE POLICY "push_subs_select" ON public.push_subscriptions FOR SELECT TO authenticated
USING (leader_id = public.current_leader_id());
CREATE POLICY "push_subs_insert" ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (leader_id = public.current_leader_id());
CREATE POLICY "push_subs_update" ON public.push_subscriptions FOR UPDATE TO authenticated
USING (leader_id = public.current_leader_id());
CREATE POLICY "push_subs_delete" ON public.push_subscriptions FOR DELETE TO authenticated
USING (leader_id = public.current_leader_id());

-- home_screen_config: authenticated read, admin write
CREATE POLICY "home_config_select" ON public.home_screen_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "home_config_insert" ON public.home_screen_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "home_config_update" ON public.home_screen_config FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "home_config_delete" ON public.home_screen_config FOR DELETE TO authenticated USING (public.is_admin());

-- room_capacity: authenticated read, admin write
CREATE POLICY "room_capacity_select" ON public.room_capacity FOR SELECT TO authenticated USING (true);
CREATE POLICY "room_capacity_insert" ON public.room_capacity FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "room_capacity_update" ON public.room_capacity FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "room_capacity_delete" ON public.room_capacity FOR DELETE TO authenticated USING (public.is_admin());

-- room_swaps: authenticated read, admin write
CREATE POLICY "room_swaps_select" ON public.room_swaps FOR SELECT TO authenticated USING (true);
CREATE POLICY "room_swaps_insert" ON public.room_swaps FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "room_swaps_update" ON public.room_swaps FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "room_swaps_delete" ON public.room_swaps FOR DELETE TO authenticated USING (public.is_admin());

-- session_activities: authenticated read, admin write
CREATE POLICY "session_activities_select" ON public.session_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "session_activities_insert" ON public.session_activities FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "session_activities_update" ON public.session_activities FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "session_activities_delete" ON public.session_activities FOR DELETE TO authenticated USING (public.is_admin());

-- extra_fields_config: authenticated read, admin write
CREATE POLICY "extra_fields_select" ON public.extra_fields_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "extra_fields_insert" ON public.extra_fields_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "extra_fields_update" ON public.extra_fields_config FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "extra_fields_delete" ON public.extra_fields_config FOR DELETE TO authenticated USING (public.is_admin());

-- Make participant-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'participant-images';
