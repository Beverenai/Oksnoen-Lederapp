
-- 1. Clean duplicate empty period
DELETE FROM public.periods WHERE id = 'b9165507-8693-4277-9876-999850a200c7';

-- 2. Rename active period to just "Periode 1" and pre-seed the rest
UPDATE public.periods SET name = 'Periode 1' WHERE id = '9b567bb1-4195-4d9e-a8a1-36bb68b48545';

INSERT INTO public.periods (name, slug, start_date, end_date, is_active)
VALUES
  ('Periode 2', 'periode-2', '2026-06-27', '2026-07-04', false),
  ('Periode 3', 'periode-3', '2026-07-05', '2026-07-12', false),
  ('Periode 4+', 'periode-4-pluss', '2026-07-13', '2026-07-20', false),
  ('Periode 5', 'periode-5', '2026-07-21', '2026-07-28', false),
  ('Periode 6', 'periode-6', '2026-07-29', '2026-08-05', false),
  ('Periode 7', 'periode-7', '2026-08-06', '2026-08-13', false)
ON CONFLICT (slug) DO NOTHING;

-- 3. Add period_id to nurse_reports
ALTER TABLE public.nurse_reports
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nurse_reports_period ON public.nurse_reports(period_id);

-- Backfill existing nurse_reports to active period
UPDATE public.nurse_reports SET period_id = public.get_active_period_id() WHERE period_id IS NULL;

-- Auto-tag new reports
DROP TRIGGER IF EXISTS set_period_id_nurse_reports ON public.nurse_reports;
CREATE TRIGGER set_period_id_nurse_reports
  BEFORE INSERT ON public.nurse_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- 4. Restrict participants visibility to active period (everyone — admins switch active period to view old)
DROP POLICY IF EXISTS "participants_select" ON public.participants;
CREATE POLICY "participants_select" ON public.participants
  FOR SELECT TO authenticated
  USING (period_id = public.get_active_period_id() OR period_id IS NULL);
