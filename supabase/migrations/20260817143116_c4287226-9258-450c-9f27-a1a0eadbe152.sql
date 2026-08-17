ALTER TABLE public.leirskole_weeks ADD COLUMN IF NOT EXISTS external_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS leirskole_weeks_external_ref_key ON public.leirskole_weeks (external_ref) WHERE external_ref IS NOT NULL;

ALTER TABLE public.leirskole_staff ADD COLUMN IF NOT EXISTS external_ref text;
CREATE INDEX IF NOT EXISTS leirskole_staff_external_ref_idx ON public.leirskole_staff (external_ref);