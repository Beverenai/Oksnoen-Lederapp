ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS leirskole_competencies_confirmed_at timestamptz;

UPDATE public.leaders
SET leirskole_competencies = ARRAY['tube','klatring','rappellering','kanotur','batkjoring','badevakt']::text[],
    leirskole_competencies_confirmed_at = NULL;