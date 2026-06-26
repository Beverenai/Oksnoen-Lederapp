ALTER TABLE public.gjenglemt_items ADD COLUMN IF NOT EXISTS bag_label text;

DROP VIEW IF EXISTS public.gjenglemt_public;
CREATE VIEW public.gjenglemt_public AS
SELECT i.id, i.period_id, i.image_url, i.garment_type, i.color, i.status, i.notes,
       i.owner_name, i.bag_label,
       i.ai_status, i.ai_description, i.ai_tags, i.created_at
FROM gjenglemt_items i
JOIN periods p ON p.id = i.period_id
WHERE p.is_public = true AND i.status = 'uavhentet';

GRANT SELECT ON public.gjenglemt_public TO anon, authenticated;