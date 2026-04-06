
-- Allow superadmin to insert roles
CREATE POLICY "user_roles_insert_superadmin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (is_superadmin());

-- Allow superadmin to delete non-superadmin roles
CREATE POLICY "user_roles_delete_superadmin"
ON public.user_roles
FOR DELETE
TO authenticated
USING (is_superadmin() AND role != 'superadmin');

-- Allow superadmin to update roles (but not superadmin entries)
CREATE POLICY "user_roles_update_superadmin"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (is_superadmin() AND role != 'superadmin');
