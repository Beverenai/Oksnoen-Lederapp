
ALTER TABLE public.gjenglemt_items
  ADD COLUMN notes text,
  ADD COLUMN ai_status text NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending','done','failed')),
  ADD COLUMN ai_description text,
  ADD COLUMN ai_tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.gjenglemt_items
  ALTER COLUMN garment_type DROP NOT NULL,
  ALTER COLUMN color DROP NOT NULL;

CREATE INDEX gjenglemt_items_ai_tags_idx ON public.gjenglemt_items USING gin (ai_tags);

DROP VIEW IF EXISTS public.gjenglemt_public;
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
  i.notes,
  i.ai_status,
  i.ai_description,
  i.ai_tags,
  i.created_at
FROM public.gjenglemt_items i
JOIN public.gjenglemt_periods p ON p.id = i.period_id
WHERE p.is_public = true
  AND i.status = 'uavhentet';

GRANT SELECT ON public.gjenglemt_public TO anon, authenticated;
