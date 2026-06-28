
ALTER TABLE public.room_swaps ADD COLUMN period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
ALTER TABLE public.fix_tasks ADD COLUMN period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;

-- Backfill existing rows to currently active period
UPDATE public.room_swaps SET period_id = public.get_active_period_id() WHERE period_id IS NULL;
UPDATE public.fix_tasks SET period_id = public.get_active_period_id() WHERE period_id IS NULL;

-- Auto-tag new rows with active period
CREATE TRIGGER set_room_swaps_period_id
  BEFORE INSERT ON public.room_swaps
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER set_fix_tasks_period_id
  BEFORE INSERT ON public.fix_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE INDEX IF NOT EXISTS idx_room_swaps_period_id ON public.room_swaps(period_id);
CREATE INDEX IF NOT EXISTS idx_fix_tasks_period_id ON public.fix_tasks(period_id);
