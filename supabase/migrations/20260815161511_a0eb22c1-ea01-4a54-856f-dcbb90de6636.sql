ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS extra_sips integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.my_sips_left()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.leaders l
       WHERE l.id = public.current_leader_id()
         AND lower(l.name) ILIKE '%august%frisvold%'
    ) THEN 999999
    ELSE GREATEST(
      (10 + COALESCE((SELECT l.extra_sips FROM public.leaders l WHERE l.id = public.current_leader_id()), 0))
      - COALESCE((
        SELECT sum(s.amount)::int FROM public.leader_sips s
         WHERE s.from_leader_id = public.current_leader_id()
           AND s.season_year = EXTRACT(YEAR FROM now())::int
      ), 0), 0)
  END
$function$;

CREATE OR REPLACE FUNCTION public.grant_extra_sips(_leader_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'Ugyldig antall';
  END IF;
  IF abs(_amount) > 1000 THEN
    RAISE EXCEPTION 'For stort antall';
  END IF;

  UPDATE public.leaders
     SET extra_sips = GREATEST(COALESCE(extra_sips, 0) + _amount, 0)
   WHERE id = _leader_id
  RETURNING extra_sips INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'Leder ikke funnet';
  END IF;

  RETURN _new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sips_admin_overview()
RETURNS TABLE(leader_id uuid, leader_name text, profile_image_url text, is_active boolean, extra_sips integer, given integer, sips_left integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT l.id, l.name, l.profile_image_url, l.is_active,
         COALESCE(l.extra_sips, 0),
         COALESCE(g.total, 0)::int,
         GREATEST(10 + COALESCE(l.extra_sips, 0) - COALESCE(g.total, 0)::int, 0)
    FROM public.leaders l
    LEFT JOIN (
      SELECT s.from_leader_id, sum(s.amount)::int AS total
        FROM public.leader_sips s
       WHERE s.season_year = EXTRACT(YEAR FROM now())::int
       GROUP BY s.from_leader_id
    ) g ON g.from_leader_id = l.id
   WHERE public.is_admin()
     AND COALESCE(l.is_external, false) = false
     AND l.deleted_at IS NULL
   ORDER BY l.name
$function$;