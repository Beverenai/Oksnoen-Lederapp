CREATE OR REPLACE FUNCTION public.edit_kiosk_sale(_sale_id uuid, _items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := public.current_leader_id();
  _sale public.kiosk_sales;
  _total numeric := 0;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Tom handlekurv'; END IF;

  SELECT * INTO _sale FROM public.kiosk_sales WHERE id = _sale_id;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'Salg ikke funnet'; END IF;
  IF _sale.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Salget er annullert'; END IF;
  IF NOT public.is_admin() AND (_sale.sold_by IS DISTINCT FROM _me OR _sale.created_at < now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;

  DELETE FROM public.kiosk_sale_items WHERE sale_id = _sale_id;

  INSERT INTO public.kiosk_sale_items (sale_id, product_id, product_name, unit_price, quantity)
  SELECT _sale_id, pr.id, pr.name, pr.price, GREATEST((it->>'quantity')::int, 1)
  FROM jsonb_array_elements(_items) AS it
  JOIN public.kiosk_products pr ON pr.id = (it->>'product_id')::uuid;

  SELECT COALESCE(sum(unit_price * quantity), 0) INTO _total
  FROM public.kiosk_sale_items WHERE sale_id = _sale_id;

  IF _total = 0 THEN RAISE EXCEPTION 'Ingen gyldige varer'; END IF;

  UPDATE public.kiosk_sales SET total = _total WHERE id = _sale_id;
END;
$function$;