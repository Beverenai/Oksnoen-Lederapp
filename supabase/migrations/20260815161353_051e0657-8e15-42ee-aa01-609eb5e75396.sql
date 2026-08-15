CREATE OR REPLACE FUNCTION public.my_sips_left()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.leaders l
       WHERE l.id = public.current_leader_id()
         AND lower(l.name) ILIKE '%august%frisvold%'
    ) THEN 999999
    ELSE GREATEST(10 - COALESCE((
      SELECT sum(s.amount)::int FROM public.leader_sips s
       WHERE s.from_leader_id = public.current_leader_id()
         AND s.season_year = EXTRACT(YEAR FROM now())::int
    ), 0), 0)
  END
$$;