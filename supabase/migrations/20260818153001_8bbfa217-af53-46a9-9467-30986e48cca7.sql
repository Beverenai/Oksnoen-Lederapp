ALTER TABLE public.leirskole_kitchen_days
  ADD COLUMN IF NOT EXISTS hours numeric NOT NULL DEFAULT 8;