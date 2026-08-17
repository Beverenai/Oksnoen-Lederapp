CREATE OR REPLACE FUNCTION public.is_leirskole_week_member(_week_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leirskole_staff s
    WHERE s.week_id = _week_id AND s.leader_id = public.current_leader_id()
  )
$$;

REVOKE ALL ON FUNCTION public.is_leirskole_week_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_leirskole_week_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS leirskole_staff_read_own_week ON public.leirskole_staff;
CREATE POLICY leirskole_staff_read_own_week ON public.leirskole_staff
  FOR SELECT TO authenticated
  USING (public.is_leirskole_week_member(week_id));

DROP POLICY IF EXISTS leirskole_weeks_read_own ON public.leirskole_weeks;
CREATE POLICY leirskole_weeks_read_own ON public.leirskole_weeks
  FOR SELECT TO authenticated
  USING (public.is_leirskole_week_member(id));

DROP POLICY IF EXISTS leirskole_posts_read_published ON public.leirskole_posts;
CREATE POLICY leirskole_posts_read_published ON public.leirskole_posts
  FOR SELECT TO authenticated
  USING (
    public.is_leirskole_week_member(week_id)
    AND EXISTS (
      SELECT 1 FROM public.leirskole_weeks w
      WHERE w.id = leirskole_posts.week_id AND w.schedule_published_at IS NOT NULL
    )
  );