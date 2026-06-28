
DROP VIEW IF EXISTS public.gjenglemt_public;

ALTER TABLE public.gjenglemt_items
  ADD COLUMN IF NOT EXISTS item_number integer;

WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY period_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.gjenglemt_items
)
UPDATE public.gjenglemt_items g
SET item_number = n.rn
FROM numbered n
WHERE g.id = n.id AND g.item_number IS NULL;

CREATE OR REPLACE FUNCTION public.assign_gjenglemt_item_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.item_number IS NULL THEN
    SELECT COALESCE(MAX(item_number), 0) + 1
      INTO NEW.item_number
      FROM public.gjenglemt_items
      WHERE period_id = NEW.period_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_item_number_on_gjenglemt ON public.gjenglemt_items;
CREATE TRIGGER assign_item_number_on_gjenglemt
  BEFORE INSERT ON public.gjenglemt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_gjenglemt_item_number();

CREATE UNIQUE INDEX IF NOT EXISTS gjenglemt_items_period_number_uidx
  ON public.gjenglemt_items(period_id, item_number);

CREATE VIEW public.gjenglemt_public AS
SELECT i.id,
       i.period_id,
       i.image_url,
       i.garment_type,
       i.color,
       i.status,
       i.notes,
       i.owner_name,
       i.bag_label,
       i.item_number,
       i.ai_status,
       i.ai_description,
       i.ai_tags,
       i.created_at
FROM public.gjenglemt_items i
JOIN public.periods p ON p.id = i.period_id
WHERE p.is_public = true AND i.status = 'uavhentet'::text;

GRANT SELECT ON public.gjenglemt_public TO anon, authenticated;
