
ALTER TABLE public.cabin_reports ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE;

UPDATE public.cabin_reports SET period_id = public.get_active_period_id() WHERE period_id IS NULL;

ALTER TABLE public.cabin_reports DROP CONSTRAINT IF EXISTS cabin_reports_cabin_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS cabin_reports_cabin_period_unique ON public.cabin_reports(cabin_id, period_id);

DROP TRIGGER IF EXISTS set_period_id_cabin_reports ON public.cabin_reports;
CREATE TRIGGER set_period_id_cabin_reports
  BEFORE INSERT ON public.cabin_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_period_id_default();
