
-- 1) participant_teams table
CREATE TABLE public.participant_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  slot INT NOT NULL CHECK (slot BETWEEN 1 AND 10),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_teams TO authenticated;
GRANT ALL ON public.participant_teams TO service_role;

ALTER TABLE public.participant_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read teams"
  ON public.participant_teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert teams"
  ON public.participant_teams FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update teams"
  ON public.participant_teams FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete teams"
  ON public.participant_teams FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_participant_teams_updated_at
  BEFORE UPDATE ON public.participant_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) team_id column on participants
ALTER TABLE public.participants
  ADD COLUMN team_id UUID REFERENCES public.participant_teams(id) ON DELETE SET NULL;

CREATE INDEX idx_participants_team_id ON public.participants(team_id);

-- 3) Seed 10 teams for every existing period
INSERT INTO public.participant_teams (period_id, slot, name, color)
SELECT
  p.id,
  s.slot,
  'Lag ' || s.slot,
  (ARRAY['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899'])[s.slot]
FROM public.periods p
CROSS JOIN generate_series(1,10) AS s(slot)
ON CONFLICT (period_id, slot) DO NOTHING;

-- 4) Auto-seed 10 teams when a new period is created
CREATE OR REPLACE FUNCTION public.seed_participant_teams_for_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.participant_teams (period_id, slot, name, color)
  SELECT NEW.id, s.slot, 'Lag ' || s.slot,
    (ARRAY['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899'])[s.slot]
  FROM generate_series(1,10) AS s(slot)
  ON CONFLICT (period_id, slot) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_participant_teams
  AFTER INSERT ON public.periods
  FOR EACH ROW EXECUTE FUNCTION public.seed_participant_teams_for_period();

-- 5) Insert teams_enabled flag into app_config
INSERT INTO public.app_config (key, value)
VALUES ('teams_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
