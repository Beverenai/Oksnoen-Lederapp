CREATE TABLE public.admin_pins (
  leader_id uuid PRIMARY KEY REFERENCES public.leaders(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_pins TO service_role;

ALTER TABLE public.admin_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to admin pins"
ON public.admin_pins FOR SELECT TO authenticated USING (false);

CREATE TRIGGER admin_pins_updated_at
BEFORE UPDATE ON public.admin_pins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();