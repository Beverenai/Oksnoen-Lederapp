-- Tables
CREATE TABLE public.murder_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  winner_leader_id uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id)
);

CREATE TABLE public.murder_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.murder_games(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  target_leader_id uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  is_alive boolean NOT NULL DEFAULT true,
  killed_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  killed_at timestamptz,
  kills integer NOT NULL DEFAULT 0,
  ring_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, leader_id)
);

CREATE TABLE public.murder_kill_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.murder_games(id) ON DELETE CASCADE,
  killer_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  victim_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  confirmed_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_murder_players_game ON public.murder_players(game_id);
CREATE INDEX idx_murder_claims_game ON public.murder_kill_claims(game_id);

-- Grants
GRANT SELECT ON public.murder_games TO authenticated;
GRANT ALL ON public.murder_games TO service_role;
GRANT SELECT ON public.murder_players TO authenticated;
GRANT ALL ON public.murder_players TO service_role;
GRANT SELECT ON public.murder_kill_claims TO authenticated;
GRANT ALL ON public.murder_kill_claims TO service_role;

-- RLS
ALTER TABLE public.murder_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.murder_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.murder_kill_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can view games" ON public.murder_games
  FOR SELECT TO authenticated USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admins manage games" ON public.murder_games
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Players see own row or admin" ON public.murder_players
  FOR SELECT TO authenticated
  USING (leader_id = public.current_leader_id() OR public.is_admin());
CREATE POLICY "Admins manage players" ON public.murder_players
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Claims visible to involved or admin" ON public.murder_kill_claims
  FOR SELECT TO authenticated
  USING (
    killer_leader_id = public.current_leader_id()
    OR victim_leader_id = public.current_leader_id()
    OR public.is_admin()
  );
CREATE POLICY "Admins manage claims" ON public.murder_kill_claims
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- updated_at triggers
CREATE TRIGGER trg_murder_games_updated BEFORE UPDATE ON public.murder_games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_murder_players_updated BEFORE UPDATE ON public.murder_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_murder_claims_updated BEFORE UPDATE ON public.murder_kill_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Start / reset game (admin only)
CREATE OR REPLACE FUNCTION public.start_murder_game(_leader_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period_id uuid;
  _game_id uuid;
  _count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;

  _period_id := public.get_active_period_id();
  IF _period_id IS NULL THEN
    RAISE EXCEPTION 'Ingen aktiv periode';
  END IF;

  SELECT count(*) INTO _count FROM unnest(_leader_ids);
  IF _count < 3 THEN
    RAISE EXCEPTION 'Trenger minst 3 deltakere';
  END IF;

  INSERT INTO public.murder_games (period_id, is_active, started_at)
  VALUES (_period_id, true, now())
  ON CONFLICT (period_id) DO UPDATE
    SET is_active = true, started_at = now(), winner_leader_id = NULL, updated_at = now()
  RETURNING id INTO _game_id;

  DELETE FROM public.murder_kill_claims WHERE game_id = _game_id;
  DELETE FROM public.murder_players WHERE game_id = _game_id;

  WITH shuffled AS (
    SELECT l AS leader_id, row_number() OVER (ORDER BY random()) AS rn
    FROM unnest(_leader_ids) AS l
  ), ring AS (
    SELECT leader_id, rn,
           lead(leader_id) OVER (ORDER BY rn) AS next_leader
    FROM shuffled
  ), first_leader AS (
    SELECT leader_id FROM shuffled WHERE rn = 1
  )
  INSERT INTO public.murder_players (game_id, leader_id, target_leader_id, ring_order)
  SELECT _game_id, r.leader_id,
         COALESCE(r.next_leader, (SELECT leader_id FROM first_leader)),
         r.rn
  FROM ring r;

  RETURN _game_id;
END;
$$;

-- Killer reports a kill (pending victim confirmation)
CREATE OR REPLACE FUNCTION public.claim_murder_kill()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _player public.murder_players;
  _game public.murder_games;
  _claim_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;

  SELECT g.* INTO _game FROM public.murder_games g
   WHERE g.period_id = public.get_active_period_id() AND g.is_active;
  IF _game.id IS NULL THEN RAISE EXCEPTION 'Ingen aktivt spill'; END IF;

  SELECT * INTO _player FROM public.murder_players
   WHERE game_id = _game.id AND leader_id = _me;
  IF _player.id IS NULL THEN RAISE EXCEPTION 'Du er ikke med i spillet'; END IF;
  IF NOT _player.is_alive THEN RAISE EXCEPTION 'Du er ute av spillet'; END IF;
  IF _player.target_leader_id IS NULL THEN RAISE EXCEPTION 'Du har ingen m??l'; END IF;

  SELECT id INTO _claim_id FROM public.murder_kill_claims
   WHERE game_id = _game.id AND killer_leader_id = _me
     AND victim_leader_id = _player.target_leader_id AND status = 'pending';
  IF _claim_id IS NOT NULL THEN RETURN _claim_id; END IF;

  INSERT INTO public.murder_kill_claims (game_id, killer_leader_id, victim_leader_id)
  VALUES (_game.id, _me, _player.target_leader_id)
  RETURNING id INTO _claim_id;

  RETURN _claim_id;
END;
$$;

-- Victim (or admin) confirms death
CREATE OR REPLACE FUNCTION public.confirm_murder_death(_claim_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _claim public.murder_kill_claims;
  _victim public.murder_players;
  _alive int;
  _winner uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;

  IF _claim_id IS NULL THEN
    SELECT c.* INTO _claim FROM public.murder_kill_claims c
      JOIN public.murder_games g ON g.id = c.game_id
     WHERE c.victim_leader_id = _me AND c.status = 'pending'
       AND g.period_id = public.get_active_period_id()
     ORDER BY c.created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO _claim FROM public.murder_kill_claims WHERE id = _claim_id;
  END IF;

  IF _claim.id IS NULL THEN RAISE EXCEPTION 'Ingen ventende drapsmelding'; END IF;
  IF _claim.victim_leader_id <> _me AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;
  IF _claim.status <> 'pending' THEN RETURN; END IF;

  SELECT * INTO _victim FROM public.murder_players
   WHERE game_id = _claim.game_id AND leader_id = _claim.victim_leader_id;
  IF _victim.id IS NULL THEN RAISE EXCEPTION 'Offer ikke funnet'; END IF;

  UPDATE public.murder_players
     SET is_alive = false, killed_by = _claim.killer_leader_id,
         killed_at = now(), target_leader_id = NULL
   WHERE id = _victim.id;

  UPDATE public.murder_players
     SET target_leader_id = CASE
           WHEN _victim.target_leader_id = leader_id THEN NULL
           ELSE _victim.target_leader_id END,
         kills = kills + 1
   WHERE game_id = _claim.game_id AND leader_id = _claim.killer_leader_id;

  UPDATE public.murder_kill_claims
     SET status = 'confirmed', confirmed_at = now(), confirmed_by = _me
   WHERE id = _claim.id;

  DELETE FROM public.murder_kill_claims
   WHERE game_id = _claim.game_id AND status = 'pending'
     AND (victim_leader_id = _claim.victim_leader_id OR killer_leader_id = _claim.victim_leader_id);

  SELECT count(*) INTO _alive FROM public.murder_players
   WHERE game_id = _claim.game_id AND is_alive;
  IF _alive <= 1 THEN
    SELECT leader_id INTO _winner FROM public.murder_players
     WHERE game_id = _claim.game_id AND is_alive LIMIT 1;
    UPDATE public.murder_games SET winner_leader_id = _winner WHERE id = _claim.game_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_murder_overview()
RETURNS TABLE(
  leader_id uuid, leader_name text, target_leader_id uuid,
  is_alive boolean, killed_by uuid, killed_at timestamptz,
  kills integer, ring_order integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.leader_id, l.name, p.target_leader_id, p.is_alive,
         p.killed_by, p.killed_at, p.kills, p.ring_order
  FROM public.murder_players p
  JOIN public.leaders l ON l.id = p.leader_id
  JOIN public.murder_games g ON g.id = p.game_id
  WHERE g.period_id = public.get_active_period_id()
    AND public.is_admin()
  ORDER BY p.ring_order
$$;

CREATE OR REPLACE FUNCTION public.get_my_murder_state()
RETURNS TABLE(
  game_id uuid, is_active boolean, winner_leader_id uuid,
  target_leader_id uuid, target_name text, target_image_url text,
  is_alive boolean, killed_by_name text, kills integer,
  pending_claim_id uuid, pending_claim_victim_name text,
  incoming_claim_id uuid, incoming_claim_killer_name text,
  alive_count integer, total_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.is_active, g.winner_leader_id,
         p.target_leader_id, t.name, t.profile_image_url,
         p.is_alive, kb.name, p.kills,
         oc.id, ocv.name,
         ic.id, ick.name,
         (SELECT count(*)::int FROM public.murder_players mp WHERE mp.game_id = g.id AND mp.is_alive),
         (SELECT count(*)::int FROM public.murder_players mp WHERE mp.game_id = g.id)
  FROM public.murder_games g
  JOIN public.murder_players p ON p.game_id = g.id AND p.leader_id = public.current_leader_id()
  LEFT JOIN public.leaders t ON t.id = p.target_leader_id
  LEFT JOIN public.leaders kb ON kb.id = p.killed_by
  LEFT JOIN public.murder_kill_claims oc
    ON oc.game_id = g.id AND oc.killer_leader_id = p.leader_id AND oc.status = 'pending'
  LEFT JOIN public.leaders ocv ON ocv.id = oc.victim_leader_id
  LEFT JOIN public.murder_kill_claims ic
    ON ic.game_id = g.id AND ic.victim_leader_id = p.leader_id AND ic.status = 'pending'
  LEFT JOIN public.leaders ick ON ick.id = ic.killer_leader_id
  WHERE g.period_id = public.get_active_period_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_murder_game_active(_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Ikke tilgang'; END IF;
  INSERT INTO public.murder_games (period_id, is_active)
  VALUES (public.get_active_period_id(), _active)
  ON CONFLICT (period_id) DO UPDATE SET is_active = _active, updated_at = now();
END;
$$;