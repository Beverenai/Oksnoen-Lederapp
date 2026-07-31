REVOKE ALL ON FUNCTION public.get_archive_participants(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_archive_participants(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_archive_participants(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_archive_participants(uuid) TO service_role;