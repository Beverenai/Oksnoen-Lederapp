CREATE OR REPLACE FUNCTION public.mark_fix_task_fixed(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
BEGIN
  IF _me IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ingen leder';
  END IF;

  UPDATE public.fix_tasks
     SET status = 'fixed',
         fixed_at = now(),
         fixed_by = _me
   WHERE id = _task_id
     AND status <> 'fixed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_fix_task_fixed(uuid) TO authenticated;