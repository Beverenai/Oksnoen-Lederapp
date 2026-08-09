CREATE OR REPLACE FUNCTION public.is_kitchen()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.has_role(public.current_leader_id(), 'kitchen'), false)
$$;

CREATE TABLE public.kitchen_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  icon text,
  kind text NOT NULL DEFAULT 'checklist',
  body text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_sections TO authenticated;
GRANT ALL ON public.kitchen_sections TO service_role;
ALTER TABLE public.kitchen_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kitchen and admins can view sections"
  ON public.kitchen_sections FOR SELECT TO authenticated
  USING (public.is_kitchen() OR public.is_admin());
CREATE POLICY "Admins can insert sections"
  ON public.kitchen_sections FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update sections"
  ON public.kitchen_sections FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete sections"
  ON public.kitchen_sections FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER kitchen_sections_updated_at
  BEFORE UPDATE ON public.kitchen_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kitchen_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id uuid NOT NULL REFERENCES public.kitchen_sections(id) ON DELETE CASCADE,
  label text NOT NULL,
  hint text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX kitchen_items_section_idx ON public.kitchen_items(section_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_items TO authenticated;
GRANT ALL ON public.kitchen_items TO service_role;
ALTER TABLE public.kitchen_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kitchen and admins can view items"
  ON public.kitchen_items FOR SELECT TO authenticated
  USING (public.is_kitchen() OR public.is_admin());
CREATE POLICY "Admins can insert items"
  ON public.kitchen_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update items"
  ON public.kitchen_items FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete items"
  ON public.kitchen_items FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER kitchen_items_updated_at
  BEFORE UPDATE ON public.kitchen_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kitchen_item_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.kitchen_items(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE,
  checked_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (item_id, period_id)
);

CREATE INDEX kitchen_item_checks_period_idx ON public.kitchen_item_checks(period_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_item_checks TO authenticated;
GRANT ALL ON public.kitchen_item_checks TO service_role;
ALTER TABLE public.kitchen_item_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kitchen and admins can view checks"
  ON public.kitchen_item_checks FOR SELECT TO authenticated
  USING (public.is_kitchen() OR public.is_admin());
CREATE POLICY "Kitchen and admins can insert checks"
  ON public.kitchen_item_checks FOR INSERT TO authenticated
  WITH CHECK (public.is_kitchen() OR public.is_admin());
CREATE POLICY "Kitchen and admins can update checks"
  ON public.kitchen_item_checks FOR UPDATE TO authenticated
  USING (public.is_kitchen() OR public.is_admin())
  WITH CHECK (public.is_kitchen() OR public.is_admin());
CREATE POLICY "Kitchen and admins can delete checks"
  ON public.kitchen_item_checks FOR DELETE TO authenticated
  USING (public.is_kitchen() OR public.is_admin());

CREATE TRIGGER kitchen_item_checks_set_period
  BEFORE INSERT ON public.kitchen_item_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER kitchen_item_checks_updated_at
  BEFORE UPDATE ON public.kitchen_item_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();