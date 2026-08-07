ALTER TABLE public.kiosk_sales ADD COLUMN IF NOT EXISTS sale_number integer;

CREATE OR REPLACE FUNCTION public.assign_kiosk_sale_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN
    SELECT COALESCE(MAX(sale_number), 0) + 1
      INTO NEW.sale_number
      FROM public.kiosk_sales
     WHERE period_id IS NOT DISTINCT FROM NEW.period_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kiosk_sales_number ON public.kiosk_sales;
CREATE TRIGGER trg_kiosk_sales_number
BEFORE INSERT ON public.kiosk_sales
FOR EACH ROW EXECUTE FUNCTION public.assign_kiosk_sale_number();

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY period_id ORDER BY created_at) AS rn
    FROM public.kiosk_sales
)
UPDATE public.kiosk_sales s SET sale_number = n.rn
  FROM numbered n WHERE n.id = s.id AND s.sale_number IS NULL;