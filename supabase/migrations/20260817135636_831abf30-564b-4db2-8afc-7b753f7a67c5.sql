CREATE OR REPLACE FUNCTION public.leirskole_post_duration(_start time, _end time)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _end > _start THEN EXTRACT(EPOCH FROM (_end - _start)) / 3600.0
    ELSE EXTRACT(EPOCH FROM ((_end + interval '24 hours') - _start)) / 3600.0
  END;
$$;