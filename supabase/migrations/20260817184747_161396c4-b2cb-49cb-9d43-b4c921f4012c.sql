ALTER TABLE public.leirskole_posts
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.leirskole_week_plan_cells (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  date date NOT NULL,
  row_index integer NOT NULL,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'neutral',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (week_id, date, row_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_week_plan_cells TO authenticated;
GRANT ALL ON public.leirskole_week_plan_cells TO service_role;

ALTER TABLE public.leirskole_week_plan_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leirskole_week_plan_admin" ON public.leirskole_week_plan_cells
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin())
  WITH CHECK (public.is_admin() OR public.is_superadmin());

CREATE POLICY "leirskole_week_plan_read_members" ON public.leirskole_week_plan_cells
  FOR SELECT TO authenticated
  USING (public.is_leirskole_week_member(week_id));

CREATE TRIGGER leirskole_week_plan_cells_updated_at
  BEFORE UPDATE ON public.leirskole_week_plan_cells
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();