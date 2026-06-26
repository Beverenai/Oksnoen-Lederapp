
CREATE TABLE public.nurse_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nurse_periods TO authenticated;
GRANT ALL ON public.nurse_periods TO service_role;

ALTER TABLE public.nurse_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view nurse periods"
  ON public.nurse_periods FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins and nurses can insert nurse periods"
  ON public.nurse_periods FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.is_nurse());

CREATE POLICY "Admins and nurses can update nurse periods"
  ON public.nurse_periods FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_nurse());

CREATE POLICY "Admins and nurses can delete nurse periods"
  ON public.nurse_periods FOR DELETE
  TO authenticated USING (public.is_admin() OR public.is_nurse());

CREATE TRIGGER update_nurse_periods_updated_at
  BEFORE UPDATE ON public.nurse_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
