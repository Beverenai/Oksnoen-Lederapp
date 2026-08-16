CREATE OR REPLACE FUNCTION public.swipe_leader(_target uuid, _liked boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := public.current_leader_id();
  _mutual boolean := false;
  _a uuid;
  _b uuid;
  _new_match uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _target IS NULL OR _target = _me THEN RAISE EXCEPTION 'Ugyldig valg'; END IF;

  INSERT INTO public.leader_swipes (swiper_leader_id, target_leader_id, liked)
  VALUES (_me, _target, _liked)
  ON CONFLICT (swiper_leader_id, target_leader_id)
  DO UPDATE SET liked = EXCLUDED.liked, updated_at = now();

  IF NOT _liked THEN RETURN false; END IF;

  SELECT true INTO _mutual
    FROM public.leader_swipes s
   WHERE s.swiper_leader_id = _target
     AND s.target_leader_id = _me
     AND s.liked;

  IF COALESCE(_mutual, false) THEN
    _a := LEAST(_me, _target);
    _b := GREATEST(_me, _target);
    INSERT INTO public.leader_matches (leader_a_id, leader_b_id)
    VALUES (_a, _b)
    ON CONFLICT (leader_a_id, leader_b_id) DO NOTHING
    RETURNING id INTO _new_match;
    -- Kun ny match gir "Det er match!" — ingen doble feiringer.
    RETURN _new_match IS NOT NULL;
  END IF;

  RETURN false;
END;
$function$;