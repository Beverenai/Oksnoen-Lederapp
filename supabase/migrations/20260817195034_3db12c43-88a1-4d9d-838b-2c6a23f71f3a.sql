CREATE TABLE public.leirskole_kitchen_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.leirskole_staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_kitchen_days TO authenticated;
GRANT ALL ON public.leirskole_kitchen_days TO service_role;

ALTER TABLE public.leirskole_kitchen_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leirskole and admins can view kitchen days"
ON public.leirskole_kitchen_days FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE POLICY "Admins manage kitchen days"
ON public.leirskole_kitchen_days FOR ALL TO authenticated
USING (public.is_admin() OR public.is_superadmin())
WITH CHECK (public.is_admin() OR public.is_superadmin());

CREATE TRIGGER update_leirskole_kitchen_days_updated_at
BEFORE UPDATE ON public.leirskole_kitchen_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();