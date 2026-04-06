
INSERT INTO public.user_roles (leader_id, role)
VALUES ('8577f1b8-5ff4-4a2c-a71d-8c919650ec5a', 'superadmin')
ON CONFLICT (leader_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    public.has_role(public.current_leader_id(), 'admin')
    OR public.has_role(public.current_leader_id(), 'superadmin'),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(public.has_role(public.current_leader_id(), 'superadmin'), false)
$$;
