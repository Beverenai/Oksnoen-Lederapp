ALTER TABLE public.murder_games
  ADD COLUMN IF NOT EXISTS round_number integer NOT NULL DEFAULT 1;

CREATE TABLE public.murder_round_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid REFERENCES public.periods(id),
  game_id uuid,
  round_number integer NOT NULL DEFAULT 1,
  winner_leader_id uuid REFERENCES public.leaders(id),
  player_count integer NOT NULL DEFAULT 0,
  kill_count integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_by uuid REFERENCES public.leaders(id),
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.murder_round_snapshots TO authenticated;
GRANT ALL ON public.murder_round_snapshots TO service_role;

ALTER TABLE public.murder_round_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view murder round snapshots"
  ON public.murder_round_snapshots FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert murder round snapshots"
  ON public.murder_round_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update murder round snapshots"
  ON public.murder_round_snapshots FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete murder round snapshots"
  ON public.murder_round_snapshots FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_murder_round_snapshots_updated
  BEFORE UPDATE ON public.murder_round_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.archive_murder_round()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _game public.murder_games;
  _rows jsonb;
  _players int;
  _kills int;
  _snapshot_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;

  SELECT g.* INTO _game
    FROM public.murder_games g
   WHERE g.period_id = public.get_active_period_id();
  IF _game.id IS NULL THEN
    RAISE EXCEPTION 'Ingen spill å arkivere';
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.ring_order), '[]'::jsonb),
         count(*)::int,
         COALESCE(sum(CASE WHEN t.killed_by IS NOT NULL THEN 1 ELSE 0 END), 0)::int
    INTO _rows, _players, _kills
  FROM (
    SELECT mp.leader_id, l.name AS leader_name, mp.is_alive, mp.kills,
           mp.killed_by, kb.name AS killed_by_name, mp.killed_at,
           mp.target_leader_id, tl.name AS target_name, mp.ring_order
      FROM public.murder_players mp
      JOIN public.leaders l ON l.id = mp.leader_id
      LEFT JOIN public.leaders kb ON kb.id = mp.killed_by
      LEFT JOIN public.leaders tl ON tl.id = mp.target_leader_id
     WHERE mp.game_id = _game.id
  ) t;

  IF _players = 0 THEN
    RAISE EXCEPTION 'Ingen spillere å arkivere';
  END IF;

  INSERT INTO public.murder_round_snapshots
    (period_id, game_id, round_number, winner_leader_id, player_count, kill_count, data, archived_by)
  VALUES
    (_game.period_id, _game.id, COALESCE(_game.round_number, 1), _game.winner_leader_id,
     _players, _kills, _rows, public.current_leader_id())
  RETURNING id INTO _snapshot_id;

  UPDATE public.murder_games
     SET round_number = COALESCE(round_number, 1) + 1, updated_at = now()
   WHERE id = _game.id;

  RETURN _snapshot_id;
END;
$$;