-- ============ CATALOG ============
CREATE TABLE public.kiosk_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#22c55e',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_categories TO authenticated;
GRANT ALL ON public.kiosk_categories TO service_role;
ALTER TABLE public.kiosk_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders can view kiosk categories" ON public.kiosk_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage kiosk categories" ON public.kiosk_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_kiosk_categories_updated BEFORE UPDATE ON public.kiosk_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kiosk_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.kiosk_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_products TO authenticated;
GRANT ALL ON public.kiosk_products TO service_role;
ALTER TABLE public.kiosk_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders can view kiosk products" ON public.kiosk_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage kiosk products" ON public.kiosk_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_kiosk_products_updated BEFORE UPDATE ON public.kiosk_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_kiosk_products_category ON public.kiosk_products(category_id);

-- ============ SALES ============
CREATE TABLE public.kiosk_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES public.periods(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  sold_by uuid REFERENCES public.leaders(id),
  total numeric NOT NULL DEFAULT 0,
  voided_at timestamptz,
  voided_by uuid REFERENCES public.leaders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_sales TO authenticated;
GRANT ALL ON public.kiosk_sales TO service_role;
ALTER TABLE public.kiosk_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders can view kiosk sales" ON public.kiosk_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leaders can create kiosk sales" ON public.kiosk_sales FOR INSERT TO authenticated WITH CHECK (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admins update kiosk sales" ON public.kiosk_sales FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete kiosk sales" ON public.kiosk_sales FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER trg_kiosk_sales_updated BEFORE UPDATE ON public.kiosk_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kiosk_sales_period BEFORE INSERT ON public.kiosk_sales FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
CREATE INDEX idx_kiosk_sales_participant ON public.kiosk_sales(participant_id);
CREATE INDEX idx_kiosk_sales_period ON public.kiosk_sales(period_id);

CREATE TABLE public.kiosk_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.kiosk_sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.kiosk_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_sale_items TO authenticated;
GRANT ALL ON public.kiosk_sale_items TO service_role;
ALTER TABLE public.kiosk_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders can view kiosk sale items" ON public.kiosk_sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leaders can create kiosk sale items" ON public.kiosk_sale_items FOR INSERT TO authenticated WITH CHECK (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admins delete kiosk sale items" ON public.kiosk_sale_items FOR DELETE TO authenticated USING (public.is_admin());
CREATE INDEX idx_kiosk_sale_items_sale ON public.kiosk_sale_items(sale_id);

-- ============ DEPOSITS ============
CREATE TABLE public.kiosk_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES public.periods(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  kind text NOT NULL DEFAULT 'topup',
  note text,
  created_by uuid REFERENCES public.leaders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_deposits TO authenticated;
GRANT ALL ON public.kiosk_deposits TO service_role;
ALTER TABLE public.kiosk_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders can view kiosk deposits" ON public.kiosk_deposits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage kiosk deposits" ON public.kiosk_deposits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_kiosk_deposits_updated BEFORE UPDATE ON public.kiosk_deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kiosk_deposits_period BEFORE INSERT ON public.kiosk_deposits FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
CREATE INDEX idx_kiosk_deposits_participant ON public.kiosk_deposits(participant_id);
CREATE UNIQUE INDEX idx_kiosk_deposits_booking_once ON public.kiosk_deposits(participant_id, period_id) WHERE kind = 'booking';

-- ============ BALANCES VIEW ============
CREATE VIEW public.kiosk_balances
WITH (security_invoker = true) AS
SELECT p.id AS participant_id,
       p.period_id,
       COALESCE(d.deposited, 0) AS deposited,
       COALESCE(s.spent, 0) AS spent,
       COALESCE(d.deposited, 0) - COALESCE(s.spent, 0) AS balance
FROM public.participants p
LEFT JOIN (
  SELECT participant_id, sum(amount) AS deposited
  FROM public.kiosk_deposits GROUP BY participant_id
) d ON d.participant_id = p.id
LEFT JOIN (
  SELECT participant_id, sum(total) AS spent
  FROM public.kiosk_sales WHERE voided_at IS NULL GROUP BY participant_id
) s ON s.participant_id = p.id;
GRANT SELECT ON public.kiosk_balances TO authenticated;
GRANT ALL ON public.kiosk_balances TO service_role;

-- ============ RECORD SALE ============
CREATE OR REPLACE FUNCTION public.record_kiosk_sale(_participant_id uuid, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _sale_id uuid;
  _total numeric := 0;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _participant_id IS NULL THEN RAISE EXCEPTION 'Mangler deltager'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Tom handlekurv'; END IF;

  INSERT INTO public.kiosk_sales (participant_id, sold_by, total)
  VALUES (_participant_id, _me, 0)
  RETURNING id INTO _sale_id;

  INSERT INTO public.kiosk_sale_items (sale_id, product_id, product_name, unit_price, quantity)
  SELECT _sale_id, pr.id, pr.name, pr.price, GREATEST((it->>'quantity')::int, 1)
  FROM jsonb_array_elements(_items) AS it
  JOIN public.kiosk_products pr ON pr.id = (it->>'product_id')::uuid;

  SELECT COALESCE(sum(unit_price * quantity), 0) INTO _total
  FROM public.kiosk_sale_items WHERE sale_id = _sale_id;

  IF _total = 0 THEN
    DELETE FROM public.kiosk_sales WHERE id = _sale_id;
    RAISE EXCEPTION 'Ingen gyldige varer';
  END IF;

  UPDATE public.kiosk_sales SET total = _total WHERE id = _sale_id;
  RETURN _sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_kiosk_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _sale public.kiosk_sales;
BEGIN
  SELECT * INTO _sale FROM public.kiosk_sales WHERE id = _sale_id;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'Salg ikke funnet'; END IF;
  IF NOT public.is_admin() AND (_sale.sold_by IS DISTINCT FROM _me OR _sale.created_at < now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;
  UPDATE public.kiosk_sales
     SET voided_at = now(), voided_by = _me
   WHERE id = _sale_id AND voided_at IS NULL;
END;
$$;

-- ============ SEED CATALOG ============
WITH cats AS (
  INSERT INTO public.kiosk_categories (name, color, sort_order) VALUES
    ('Brus', '#22c55e', 1),
    ('Chips', '#f59e0b', 2),
    ('Godteri', '#ec4899', 3),
    ('Sjokolade', '#3b82f6', 4)
  RETURNING id, name
)
INSERT INTO public.kiosk_products (category_id, name, price, sort_order)
SELECT c.id, v.name, v.price, v.sort_order
FROM (VALUES
  ('Brus','Cola',35,1),('Brus','Cola Zero',35,2),('Brus','Fanta Appelsin',35,3),
  ('Brus','Solo/Solo Super',35,4),('Brus','Pepsi Max',35,5),('Brus','Sprite',35,6),
  ('Brus','Urge',35,7),('Brus','Villa',35,8),
  ('Chips','Kims Sour Cream & Onion',45,1),('Chips','Kims Paprika Kick',45,2),
  ('Chips','Cheez Doodles',45,3),('Chips','Petters Gullchips',35,4),
  ('Godteri','Gott & Blandat',25,1),('Godteri','Knattar Skogsbær',30,2),
  ('Godteri','Bubs',30,3),('Godteri','Fizzypop',30,4),('Godteri','Haribo Roulette',20,5),
  ('Godteri','Maoam',20,6),('Godteri','Vepsebol',15,7),('Godteri','Love Hearts',15,8),
  ('Godteri','Kjærlighet på pinne',10,9),
  ('Sjokolade','Kvikk Lunsj',20,1),('Sjokolade','Kinder maxi',15,2),('Sjokolade','Stratos',25,3),
  ('Sjokolade','Japp',25,4),('Sjokolade','Kinder Bueno',25,5),('Sjokolade','Twix',25,6),
  ('Sjokolade','Toppris',25,7),('Sjokolade','Krokanrull',30,8),('Sjokolade','Smil',25,9),
  ('Sjokolade','Melkerull',35,10)
) AS v(cat, name, price, sort_order)
JOIN cats c ON c.name = v.cat;

-- ============ SEED BALANCES FROM BOOKINGS ============
INSERT INTO public.kiosk_deposits (period_id, participant_id, amount, kind, note)
SELECT b.period_id, b.participant_id, b.kiosk_money, 'booking', 'Fra bookinginformasjon'
FROM public.participant_bookings b
WHERE b.participant_id IS NOT NULL
  AND b.kiosk_money IS NOT NULL
  AND b.kiosk_money > 0
ON CONFLICT DO NOTHING;