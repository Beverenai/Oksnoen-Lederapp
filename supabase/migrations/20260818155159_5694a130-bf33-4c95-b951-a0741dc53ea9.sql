ALTER TABLE public.leirskole_activity_types
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

ALTER TABLE public.leirskole_weeks
  ADD COLUMN IF NOT EXISTS group_count integer NOT NULL DEFAULT 5;

CREATE TABLE public.leirskole_group_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  group_number integer NOT NULL,
  activity_key text NOT NULL,
  date date,
  session text,
  note text,
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_group_completions TO authenticated;
GRANT ALL ON public.leirskole_group_completions TO service_role;

ALTER TABLE public.leirskole_group_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle innloggede kan lese gruppeaktiviteter"
  ON public.leirskole_group_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kan legge til gruppeaktiviteter"
  ON public.leirskole_group_completions FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_superadmin() OR is_leirskole());
CREATE POLICY "Admin kan endre gruppeaktiviteter"
  ON public.leirskole_group_completions FOR UPDATE TO authenticated
  USING (is_admin() OR is_superadmin() OR is_leirskole());
CREATE POLICY "Admin kan slette gruppeaktiviteter"
  ON public.leirskole_group_completions FOR DELETE TO authenticated
  USING (is_admin() OR is_superadmin() OR is_leirskole());

CREATE INDEX idx_group_completions_week ON public.leirskole_group_completions(week_id, group_number);

CREATE TABLE public.leirskole_group_requirements (
  activity_key text PRIMARY KEY,
  required_count integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_group_requirements TO authenticated;
GRANT ALL ON public.leirskole_group_requirements TO service_role;

ALTER TABLE public.leirskole_group_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle innloggede kan lese gruppekrav"
  ON public.leirskole_group_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kan legge til gruppekrav"
  ON public.leirskole_group_requirements FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_superadmin() OR is_leirskole());
CREATE POLICY "Admin kan endre gruppekrav"
  ON public.leirskole_group_requirements FOR UPDATE TO authenticated
  USING (is_admin() OR is_superadmin() OR is_leirskole());
CREATE POLICY "Admin kan slette gruppekrav"
  ON public.leirskole_group_requirements FOR DELETE TO authenticated
  USING (is_admin() OR is_superadmin() OR is_leirskole());

CREATE TRIGGER update_group_completions_updated_at
  BEFORE UPDATE ON public.leirskole_group_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_requirements_updated_at
  BEFORE UPDATE ON public.leirskole_group_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.leirskole_group_requirements (activity_key, required_count, sort_order) VALUES
  ('klatring', 1, 1),
  ('rappellering', 1, 2),
  ('batkjoring', 1, 3),
  ('tube', 2, 4),
  ('kanotur', 2, 5),
  ('flatetur', 2, 6)
ON CONFLICT (activity_key) DO NOTHING;