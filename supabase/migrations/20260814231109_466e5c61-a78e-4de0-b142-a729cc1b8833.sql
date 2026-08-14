DROP POLICY IF EXISTS leaders_select ON public.leaders;

CREATE POLICY leaders_select ON public.leaders
FOR SELECT
TO authenticated
USING (deleted_at IS NULL OR public.is_admin());