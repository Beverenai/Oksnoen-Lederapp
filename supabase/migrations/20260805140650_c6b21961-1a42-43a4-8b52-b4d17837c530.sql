CREATE OR REPLACE FUNCTION public.revive_and_reshuffle_murder(_count integer DEFAULT 4)
 RETURNS TABLE(leader_id uuid, leader_name text, was_revived boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  _game_id uuid;
  _revived uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;

  SELECT g.id INTO _game_id
    FROM public.murder_games g
   WHERE g.period_id = public.get_active_period_id();
  IF _game_id IS NULL THEN
    RAISE EXCEPTION 'Ingen aktivt spill';
  END IF;

  SELECT array_agg(t.lid) INTO _revived
  FROM (
    SELECT mp.leader_id AS lid
      FROM public.murder_players mp
     WHERE mp.game_id = _game_id AND mp.is_alive = false
     ORDER BY random()
     LIMIT GREATEST(_count, 0)
  ) t;

  IF _revived IS NULL OR array_length(_revived, 1) = 0 THEN
    RAISE EXCEPTION 'Ingen drepte spillere å gjenopplive';
  END IF;

  UPDATE public.murder_players mp
     SET is_alive = true, killed_by = NULL, killed_at = NULL
   WHERE mp.game_id = _game_id AND mp.leader_id = ANY(_revived);

  UPDATE public.murder_games g
     SET winner_leader_id = NULL, is_active = true, updated_at = now()
   WHERE g.id = _game_id;

  DELETE FROM public.murder_kill_claims c
   WHERE c.game_id = _game_id AND c.status = 'pending';

  WITH shuffled AS (
    SELECT mp.leader_id AS lid, row_number() OVER (ORDER BY random()) AS rn
      FROM public.murder_players mp
     WHERE mp.game_id = _game_id AND mp.is_alive
  ), ring AS (
    SELECT s.lid, s.rn, lead(s.lid) OVER (ORDER BY s.rn) AS next_lid
      FROM shuffled s
  ), first_lid AS (
    SELECT s.lid FROM shuffled s WHERE s.rn = 1
  )
  UPDATE public.murder_players mp
     SET target_leader_id = COALESCE(r.next_lid, (SELECT f.lid FROM first_lid f)),
         ring_order = r.rn
    FROM ring r
   WHERE mp.game_id = _game_id AND mp.leader_id = r.lid;

  RETURN QUERY
    SELECT mp.leader_id, l.name, (mp.leader_id = ANY(_revived))
      FROM public.murder_players mp
      JOIN public.leaders l ON l.id = mp.leader_id
     WHERE mp.game_id = _game_id AND mp.is_alive
     ORDER BY mp.ring_order;
END;
$function$;