ALTER TABLE public.kiosk_sales ADD COLUMN IF NOT EXISTS client_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS kiosk_sales_client_ref_key
  ON public.kiosk_sales (client_ref) WHERE client_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_kiosk_sale(_participant_id uuid, _items jsonb, _client_ref text DEFAULT NULL)
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

  IF _client_ref IS NOT NULL THEN
    SELECT id INTO _sale_id FROM public.kiosk_sales WHERE client_ref = _client_ref;
    IF _sale_id IS NOT NULL THEN RETURN _sale_id; END IF;
  END IF;

  BEGIN
    INSERT INTO public.kiosk_sales (participant_id, sold_by, total, client_ref)
    VALUES (_participant_id, _me, 0, _client_ref)
    RETURNING id INTO _sale_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO _sale_id FROM public.kiosk_sales WHERE client_ref = _client_ref;
    RETURN _sale_id;
  END;

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

REVOKE EXECUTE ON FUNCTION public.record_kiosk_sale(uuid, jsonb, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_kiosk_sale(uuid, jsonb, text) TO authenticated, service_role;