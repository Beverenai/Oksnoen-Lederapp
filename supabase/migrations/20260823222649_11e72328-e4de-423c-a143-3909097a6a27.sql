DROP INDEX IF EXISTS public.leirskole_week_plan_cells_post_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS leirskole_week_plan_cells_post_uniq
  ON public.leirskole_week_plan_cells (week_id, date, post_id);