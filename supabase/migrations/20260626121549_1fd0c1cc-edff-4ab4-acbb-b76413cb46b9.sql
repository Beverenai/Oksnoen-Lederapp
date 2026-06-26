
CREATE TABLE public.roulette_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'both' CHECK (category IN ('senior','u18','both')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_tasks TO authenticated;
GRANT ALL ON public.roulette_tasks TO service_role;
ALTER TABLE public.roulette_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roulette_tasks_select" ON public.roulette_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "roulette_tasks_insert" ON public.roulette_tasks FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "roulette_tasks_update" ON public.roulette_tasks FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "roulette_tasks_delete" ON public.roulette_tasks FOR DELETE TO authenticated USING (is_admin());
CREATE TRIGGER roulette_tasks_updated_at BEFORE UPDATE ON public.roulette_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.roulette_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.roulette_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','skipped')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roulette_assignments_leader ON public.roulette_assignments(leader_id, status);
CREATE UNIQUE INDEX idx_roulette_one_active_per_leader ON public.roulette_assignments(leader_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_assignments TO authenticated;
GRANT ALL ON public.roulette_assignments TO service_role;
ALTER TABLE public.roulette_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roulette_assignments_select" ON public.roulette_assignments FOR SELECT TO authenticated
  USING (is_admin() OR leader_id = public.current_leader_id());
CREATE POLICY "roulette_assignments_insert" ON public.roulette_assignments FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR leader_id = public.current_leader_id());
CREATE POLICY "roulette_assignments_update" ON public.roulette_assignments FOR UPDATE TO authenticated
  USING (is_admin() OR leader_id = public.current_leader_id());
CREATE POLICY "roulette_assignments_delete" ON public.roulette_assignments FOR DELETE TO authenticated
  USING (is_admin() OR leader_id = public.current_leader_id());
CREATE TRIGGER roulette_assignments_updated_at BEFORE UPDATE ON public.roulette_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_assignments;
