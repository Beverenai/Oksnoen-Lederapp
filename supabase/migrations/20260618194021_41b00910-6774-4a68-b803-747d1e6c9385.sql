
DROP POLICY IF EXISTS leader_content_select ON public.leader_content;
CREATE POLICY leader_content_select ON public.leader_content
  FOR SELECT TO authenticated
  USING (leader_id = public.current_leader_id() OR public.is_admin());

DROP POLICY IF EXISTS app_config_select ON public.app_config;
CREATE POLICY app_config_select ON public.app_config
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS part_activities_update ON public.participant_activities;
CREATE POLICY part_activities_update ON public.participant_activities
  FOR UPDATE TO authenticated
  USING (registered_by = public.current_leader_id() OR public.is_admin())
  WITH CHECK (registered_by = public.current_leader_id() OR public.is_admin());

DROP POLICY IF EXISTS part_activities_delete ON public.participant_activities;
CREATE POLICY part_activities_delete ON public.participant_activities
  FOR DELETE TO authenticated
  USING (registered_by = public.current_leader_id() OR public.is_admin());

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_leader_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_nurse() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_leader_id() FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Leaders can upload fix images" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can update fix images" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can delete fix images" ON storage.objects;

CREATE POLICY "Authenticated can upload fix images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fix-images');
CREATE POLICY "Authenticated can update fix images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fix-images');
CREATE POLICY "Authenticated can delete fix images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fix-images');

DROP POLICY IF EXISTS "Public upload participant images" ON storage.objects;
DROP POLICY IF EXISTS "Public update participant images" ON storage.objects;
DROP POLICY IF EXISTS "Public delete participant images" ON storage.objects;

CREATE POLICY "Authenticated can upload participant images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'participant-images');
CREATE POLICY "Authenticated can update participant images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'participant-images');
CREATE POLICY "Authenticated can delete participant images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'participant-images');
