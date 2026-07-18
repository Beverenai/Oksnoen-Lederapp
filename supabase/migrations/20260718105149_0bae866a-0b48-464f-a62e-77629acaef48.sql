
CREATE TABLE public.participant_sweaters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  preordered_size TEXT,
  picked_up BOOLEAN NOT NULL DEFAULT false,
  picked_up_size TEXT,
  picked_up_at TIMESTAMPTZ,
  bought_on_camp BOOLEAN NOT NULL DEFAULT false,
  bought_size TEXT,
  bought_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, period_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_sweaters TO authenticated;
GRANT ALL ON public.participant_sweaters TO service_role;

ALTER TABLE public.participant_sweaters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sweaters"
  ON public.participant_sweaters FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert sweaters"
  ON public.participant_sweaters FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sweaters"
  ON public.participant_sweaters FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete sweaters"
  ON public.participant_sweaters FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE TRIGGER set_participant_sweaters_period_id
  BEFORE INSERT ON public.participant_sweaters
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER update_participant_sweaters_updated_at
  BEFORE UPDATE ON public.participant_sweaters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_config (key, value)
VALUES ('sweaters_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
