
-- PERIODS TABLE
CREATE TABLE public.gjenglemt_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  start_date date,
  end_date date,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gjenglemt_periods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gjenglemt_periods TO authenticated;
GRANT ALL ON public.gjenglemt_periods TO service_role;

ALTER TABLE public.gjenglemt_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public periods"
  ON public.gjenglemt_periods FOR SELECT
  TO anon
  USING (is_public = true);

CREATE POLICY "Authenticated can view all periods"
  ON public.gjenglemt_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage periods - insert"
  ON public.gjenglemt_periods FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage periods - update"
  ON public.gjenglemt_periods FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage periods - delete"
  ON public.gjenglemt_periods FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_gjenglemt_periods_updated_at
  BEFORE UPDATE ON public.gjenglemt_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ITEMS TABLE
CREATE TABLE public.gjenglemt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.gjenglemt_periods(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  garment_type text NOT NULL,
  color text NOT NULL,
  owner_name text,
  comment text,
  status text NOT NULL DEFAULT 'uavhentet' CHECK (status IN ('uavhentet','hentet')),
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gjenglemt_items_period_idx ON public.gjenglemt_items(period_id);
CREATE INDEX gjenglemt_items_color_idx ON public.gjenglemt_items(color);
CREATE INDEX gjenglemt_items_garment_idx ON public.gjenglemt_items(garment_type);

-- Anon does NOT get table-level SELECT (would expose owner_name/comment).
-- Anon reads happen via gjenglemt_public view below.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gjenglemt_items TO authenticated;
GRANT ALL ON public.gjenglemt_items TO service_role;

ALTER TABLE public.gjenglemt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view all items"
  ON public.gjenglemt_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Leaders can create items"
  ON public.gjenglemt_items FOR INSERT
  TO authenticated
  WITH CHECK (created_by = public.current_leader_id());

CREATE POLICY "Leaders can update own items, admins all"
  ON public.gjenglemt_items FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR created_by = public.current_leader_id())
  WITH CHECK (public.is_admin() OR created_by = public.current_leader_id());

CREATE POLICY "Leaders can delete own items, admins all"
  ON public.gjenglemt_items FOR DELETE
  TO authenticated
  USING (public.is_admin() OR created_by = public.current_leader_id());

CREATE TRIGGER update_gjenglemt_items_updated_at
  BEFORE UPDATE ON public.gjenglemt_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- PUBLIC VIEW (no owner_name, no comment)
CREATE VIEW public.gjenglemt_public
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.period_id,
  i.image_url,
  i.garment_type,
  i.color,
  i.status,
  i.created_at
FROM public.gjenglemt_items i
JOIN public.gjenglemt_periods p ON p.id = i.period_id
WHERE p.is_public = true
  AND i.status = 'uavhentet';

GRANT SELECT ON public.gjenglemt_public TO anon, authenticated;
