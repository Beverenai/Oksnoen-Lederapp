ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS snus_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snus_product_id text,
  ADD COLUMN IF NOT EXISTS snus_custom_label text;