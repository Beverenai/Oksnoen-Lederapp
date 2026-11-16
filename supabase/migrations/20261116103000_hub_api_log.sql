-- Logg over oppslag gjort gjennom hub-API-et (admin-dashboard og AI-assistenter).
CREATE TABLE IF NOT EXISTS public.hub_api_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  tool text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  via text NOT NULL DEFAULT 'api',
  ok boolean NOT NULL DEFAULT true,
  duration_ms integer
);
CREATE INDEX IF NOT EXISTS hub_api_log_created ON public.hub_api_log (created_at DESC);

ALTER TABLE public.hub_api_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hub_api_log TO authenticated;
GRANT ALL ON public.hub_api_log TO service_role;

-- Bare admin kan lese loggen. Skriving skjer kun fra tjenesten.
DROP POLICY IF EXISTS "Admins can read hub api log" ON public.hub_api_log;
CREATE POLICY "Admins can read hub api log"
  ON public.hub_api_log FOR SELECT TO authenticated
  USING (public.is_admin());
