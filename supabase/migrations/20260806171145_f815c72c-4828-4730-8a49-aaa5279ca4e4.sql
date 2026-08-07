CREATE OR REPLACE FUNCTION public.add_murder_player(_leader_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _game_id uuid;
  _existing public.murder_players;
  _anchor public.murder_players;
  _next_order int;
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

  SELECT * INTO _existing FROM public.murder_players
   WHERE game_id = _game_id AND leader_id = _leader_id;

  IF _existing.id IS NOT NULL AND _existing.is_alive THEN
    RAISE EXCEPTION 'Lederen er allerede med i spillet';
  END IF;

  SELECT COALESCE(MAX(ring_order), 0) + 1 INTO _next_order
    FROM public.murder_players WHERE game_id = _game_id;

  -- pick a random living player to splice after
  SELECT * INTO _anchor FROM public.murder_players
   WHERE game_id = _game_id AND is_alive AND leader_id <> _leader_id
   ORDER BY random() LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    UPDATE public.murder_players
       SET is_alive = true, killed_by = NULL, killed_at = NULL,
           target_leader_id = COALESCE(_anchor.target_leader_id, _anchor.leader_id),
           ring_order = _next_order
     WHERE id = _existing.id;
  ELSE
    INSERT INTO public.murder_players (game_id, leader_id, target_leader_id, ring_order)
    VALUES (_game_id, _leader_id,
            COALESCE(_anchor.target_leader_id, _anchor.leader_id), _next_order);
  END IF;

  IF _anchor.id IS NOT NULL THEN
    UPDATE public.murder_players
       SET target_leader_id = _leader_id
     WHERE id = _anchor.id;
  END IF;

  -- new player joining means the game is not won yet
  UPDATE public.murder_games
     SET winner_leader_id = NULL, is_active = true, updated_at = now()
   WHERE id = _game_id;

  DELETE FROM public.murder_kill_claims
   WHERE game_id = _game_id AND status = 'pending'
     AND (killer_leader_id = _anchor.leader_id OR victim_leader_id = _leader_id);
END;
$function$;