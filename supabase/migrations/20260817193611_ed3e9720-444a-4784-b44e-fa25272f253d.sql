CREATE TABLE public.leirskole_week_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_type text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_week_days TO authenticated;
GRANT ALL ON public.leirskole_week_days TO service_role;

ALTER TABLE public.leirskole_week_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leirskole_week_days_select" ON public.leirskole_week_days
FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_leirskole() OR public.is_leirskole_week_member(week_id));

CREATE POLICY "leirskole_week_days_insert" ON public.leirskole_week_days
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "leirskole_week_days_update" ON public.leirskole_week_days
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "leirskole_week_days_delete" ON public.leirskole_week_days
FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_leirskole_week_days_updated_at
BEFORE UPDATE ON public.leirskole_week_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leirskole_week_plan_cells
  ADD COLUMN IF NOT EXISTS post_id uuid NULL REFERENCES public.leirskole_posts(id) ON DELETE CASCADE;

ALTER TABLE public.leirskole_week_plan_cells ALTER COLUMN row_index DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leirskole_week_plan_cells_post_uniq
  ON public.leirskole_week_plan_cells (week_id, date, post_id)
  WHERE post_id IS NOT NULL;