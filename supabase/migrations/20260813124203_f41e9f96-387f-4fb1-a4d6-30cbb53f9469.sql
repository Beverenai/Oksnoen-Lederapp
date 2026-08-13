CREATE TABLE public.leader_swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  target_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  liked boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (swiper_leader_id, target_leader_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_swipes TO authenticated;
GRANT ALL ON public.leader_swipes TO service_role;

ALTER TABLE public.leader_swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders manage own swipes"
  ON public.leader_swipes FOR ALL TO authenticated
  USING (swiper_leader_id = public.current_leader_id())
  WITH CHECK (swiper_leader_id = public.current_leader_id());

CREATE TRIGGER trg_leader_swipes_updated
  BEFORE UPDATE ON public.leader_swipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.leader_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_a_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  leader_b_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leader_a_id, leader_b_id)
);

GRANT SELECT, DELETE ON public.leader_matches TO authenticated;
GRANT ALL ON public.leader_matches TO service_role;

ALTER TABLE public.leader_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders view own matches"
  ON public.leader_matches FOR SELECT TO authenticated
  USING (leader_a_id = public.current_leader_id() OR leader_b_id = public.current_leader_id());

CREATE POLICY "Leaders delete own matches"
  ON public.leader_matches FOR DELETE TO authenticated
  USING (leader_a_id = public.current_leader_id() OR leader_b_id = public.current_leader_id());

CREATE TRIGGER trg_leader_matches_updated
  BEFORE UPDATE ON public.leader_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.swipe_leader(_target uuid, _liked boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _mutual boolean := false;
  _a uuid;
  _b uuid;
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
    ON CONFLICT (leader_a_id, leader_b_id) DO NOTHING;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;