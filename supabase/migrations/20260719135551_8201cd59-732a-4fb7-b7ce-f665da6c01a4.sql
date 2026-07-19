
CREATE TABLE public.participant_bonus_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.participant_teams(id) ON DELETE SET NULL,
  activity_key text NOT NULL,
  activity_label text NOT NULL,
  variant text NOT NULL CHECK (variant IN ('base','extra')),
  points integer NOT NULL CHECK (points > 0),
  awarded_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pbp_participant ON public.participant_bonus_points(participant_id);
CREATE INDEX idx_pbp_period ON public.participant_bonus_points(period_id);
CREATE INDEX idx_pbp_team ON public.participant_bonus_points(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_bonus_points TO authenticated;
GRANT ALL ON public.participant_bonus_points TO service_role;

ALTER TABLE public.participant_bonus_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bonus points"
  ON public.participant_bonus_points FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Leaders can insert bonus points"
  ON public.participant_bonus_points FOR INSERT
  TO authenticated
  WITH CHECK (awarded_by = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Leaders can delete own bonus points"
  ON public.participant_bonus_points FOR DELETE
  TO authenticated
  USING (awarded_by = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Admins can update bonus points"
  ON public.participant_bonus_points FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER set_pbp_period_id
  BEFORE INSERT ON public.participant_bonus_points
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
