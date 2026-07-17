
CREATE TABLE public.shift_planner_mini_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  min_leaders int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_planner_mini_shifts TO authenticated;
GRANT ALL ON public.shift_planner_mini_shifts TO service_role;
ALTER TABLE public.shift_planner_mini_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mini shifts" ON public.shift_planner_mini_shifts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_shift_planner_mini_shifts_updated_at BEFORE UPDATE ON public.shift_planner_mini_shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shift_planner_mini_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shift_planner_mini_shifts(id) ON DELETE CASCADE,
  day_index int NOT NULL,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, day_index, leader_id)
);
CREATE INDEX idx_spma_shift_day ON public.shift_planner_mini_assignments(shift_id, day_index);
CREATE INDEX idx_spma_leader ON public.shift_planner_mini_assignments(leader_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_planner_mini_assignments TO authenticated;
GRANT ALL ON public.shift_planner_mini_assignments TO service_role;
ALTER TABLE public.shift_planner_mini_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mini assignments" ON public.shift_planner_mini_assignments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
