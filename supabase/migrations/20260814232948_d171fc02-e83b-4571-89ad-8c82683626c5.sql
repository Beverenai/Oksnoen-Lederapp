ALTER TABLE public.leader_sips ADD COLUMN IF NOT EXISTS drink_type text NOT NULL DEFAULT 'beer';
ALTER TABLE public.leader_sips DROP CONSTRAINT IF EXISTS leader_sips_drink_type_check;
ALTER TABLE public.leader_sips ADD CONSTRAINT leader_sips_drink_type_check CHECK (drink_type IN ('beer','wine','drink'));