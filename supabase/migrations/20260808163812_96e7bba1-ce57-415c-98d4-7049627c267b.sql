DROP FUNCTION IF EXISTS public.get_archive_participants(uuid);

CREATE OR REPLACE FUNCTION public.get_archive_participants(_period_id uuid)
 RETURNS TABLE(id uuid, name text, birth_date date, cabin_id uuid, room text, team_id uuid, has_arrived boolean, insj_points integer, times_attended integer, pass_written boolean, notes text, image_url text, image_thumb_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.name, p.birth_date, p.cabin_id, p.room, p.team_id,
         p.has_arrived, p.insj_points, p.times_attended, p.pass_written, p.notes,
         p.image_url, p.image_thumb_url
  FROM public.participants p
  WHERE p.period_id = _period_id
    AND (public.is_admin() OR public.is_nurse())
  ORDER BY p.name
$function$;