CREATE TABLE public.leader_service_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  year integer NOT NULL,
  period_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (leader_id, year, period_code)
);

CREATE INDEX idx_leader_service_periods_leader ON public.leader_service_periods (leader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_service_periods TO authenticated;
GRANT ALL ON public.leader_service_periods TO service_role;

ALTER TABLE public.leader_service_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service periods"
ON public.leader_service_periods FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Leaders manage own service periods insert"
ON public.leader_service_periods FOR INSERT TO authenticated
WITH CHECK (leader_id = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Leaders manage own service periods delete"
ON public.leader_service_periods FOR DELETE TO authenticated
USING (leader_id = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Leaders manage own service periods update"
ON public.leader_service_periods FOR UPDATE TO authenticated
USING (leader_id = public.current_leader_id() OR public.is_admin())
WITH CHECK (leader_id = public.current_leader_id() OR public.is_admin());