
-- Create a SECURITY DEFINER function that returns all leader roles
-- This is needed by admin views and the Leaders directory to display role badges
-- Non-admin users get an empty result set; admins get all roles
CREATE OR REPLACE FUNCTION public.get_all_leader_roles()
RETURNS TABLE(leader_id uuid, role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.leader_id, ur.role 
  FROM public.user_roles ur
  WHERE public.is_admin()
     OR ur.leader_id = public.current_leader_id()
$$;
