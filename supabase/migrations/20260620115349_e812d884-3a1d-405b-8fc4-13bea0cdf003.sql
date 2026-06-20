
CREATE TABLE public.overnatting_responses (
  leader_id UUID NOT NULL PRIMARY KEY REFERENCES public.leaders(id) ON DELETE CASCADE,
  is_joining BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overnatting_responses TO authenticated;
GRANT ALL ON public.overnatting_responses TO service_role;

ALTER TABLE public.overnatting_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders manage own overnatting response"
ON public.overnatting_responses
FOR ALL
TO authenticated
USING (leader_id = public.current_leader_id() OR public.is_admin())
WITH CHECK (leader_id = public.current_leader_id() OR public.is_admin());

CREATE TRIGGER update_overnatting_responses_updated_at
BEFORE UPDATE ON public.overnatting_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
