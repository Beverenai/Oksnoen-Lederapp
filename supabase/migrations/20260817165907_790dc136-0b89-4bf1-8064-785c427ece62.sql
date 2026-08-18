CREATE OR REPLACE FUNCTION public.leirskole_post_duration(_start time without time zone, _end time without time zone)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _end > _start THEN EXTRACT(EPOCH FROM (_end - _start)) / 3600.0
    ELSE EXTRACT(EPOCH FROM ((_end - _start) + interval '24 hours')) / 3600.0
  END;
$function$;

UPDATE public.leirskole_posts
SET duration_hours = public.leirskole_post_duration(start_time, end_time)
WHERE duration_hours IS DISTINCT FROM public.leirskole_post_duration(start_time, end_time);