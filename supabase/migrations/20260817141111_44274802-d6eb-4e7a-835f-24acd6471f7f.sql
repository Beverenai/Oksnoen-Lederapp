INSERT INTO public.user_roles (leader_id, role)
SELECT id, 'leirskole'::app_role FROM public.leaders WHERE name = 'Sophie Simonsen'
ON CONFLICT (leader_id, role) DO NOTHING;