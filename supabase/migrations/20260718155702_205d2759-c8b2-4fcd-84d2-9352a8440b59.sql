
CREATE TABLE public.team_kitchen_duty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL UNIQUE REFERENCES public.periods(id) ON DELETE CASCADE,
  rotation_start_date date,
  manual_override_date date,
  manual_override_slot_a int,
  manual_override_slot_b int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_kitchen_duty TO authenticated;
GRANT ALL ON public.team_kitchen_duty TO service_role;

ALTER TABLE public.team_kitchen_duty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read kitchen duty"
  ON public.team_kitchen_duty FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert kitchen duty"
  ON public.team_kitchen_duty FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update kitchen duty"
  ON public.team_kitchen_duty FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete kitchen duty"
  ON public.team_kitchen_duty FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE TRIGGER team_kitchen_duty_updated_at
  BEFORE UPDATE ON public.team_kitchen_duty
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
