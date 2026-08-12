CREATE TABLE public.participant_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  target_leader_id uuid REFERENCES public.leaders(id) ON DELETE CASCADE,
  is_broadcast boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  claimed_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  read_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  read_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_tasks TO authenticated;
GRANT ALL ON public.participant_tasks TO service_role;

ALTER TABLE public.participant_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage participant tasks"
ON public.participant_tasks FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Leaders view their participant tasks"
ON public.participant_tasks FOR SELECT TO authenticated
USING (
  target_leader_id = public.current_leader_id()
  OR (is_broadcast AND (period_id IS NULL OR period_id = public.get_active_period_id()))
);

CREATE POLICY "Leaders update their participant tasks"
ON public.participant_tasks FOR UPDATE TO authenticated
USING (
  target_leader_id = public.current_leader_id()
  OR claimed_by = public.current_leader_id()
  OR (is_broadcast AND (period_id IS NULL OR period_id = public.get_active_period_id()))
)
WITH CHECK (
  target_leader_id = public.current_leader_id()
  OR claimed_by = public.current_leader_id()
  OR (is_broadcast AND (period_id IS NULL OR period_id = public.get_active_period_id()))
);

CREATE TRIGGER participant_tasks_set_period
BEFORE INSERT ON public.participant_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER participant_tasks_updated_at
BEFORE UPDATE ON public.participant_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_participant_task(_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _leader uuid := public.current_leader_id();
  _ok boolean := false;
BEGIN
  IF _leader IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.participant_tasks
  SET claimed_by = _leader,
      claimed_at = now(),
      status = 'claimed'
  WHERE id = _task_id
    AND is_broadcast
    AND claimed_by IS NULL
    AND status = 'open';

  _ok := FOUND;
  RETURN _ok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_participant_task(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_tasks;