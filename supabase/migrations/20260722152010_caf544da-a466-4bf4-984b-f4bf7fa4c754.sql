
-- Extend shift_schedules
ALTER TABLE public.shift_schedules
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_shift_schedules_period ON public.shift_schedules(period_id);

-- period_leaders
CREATE TABLE IF NOT EXISTS public.period_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  period_number integer NOT NULL,
  max_hours_per_day numeric(4,2) NOT NULL DEFAULT 8,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','pending','declined')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, leader_id),
  UNIQUE (period_id, period_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_leaders TO authenticated;
GRANT ALL ON public.period_leaders TO service_role;
ALTER TABLE public.period_leaders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "period_leaders_admin_all" ON public.period_leaders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "period_leaders_self_read" ON public.period_leaders FOR SELECT TO authenticated USING (leader_id = public.current_leader_id());
CREATE INDEX idx_period_leaders_period ON public.period_leaders(period_id);
CREATE INDEX idx_period_leaders_leader ON public.period_leaders(leader_id);
CREATE TRIGGER trg_period_leaders_updated BEFORE UPDATE ON public.period_leaders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- leader_availability
CREATE TABLE IF NOT EXISTS public.leader_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_leader_id uuid NOT NULL REFERENCES public.period_leaders(id) ON DELETE CASCADE,
  date date NOT NULL,
  available boolean NOT NULL DEFAULT true,
  from_time time,
  to_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_leader_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_availability TO authenticated;
GRANT ALL ON public.leader_availability TO service_role;
ALTER TABLE public.leader_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leader_availability_admin_all" ON public.leader_availability FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "leader_availability_self_all" ON public.leader_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.period_leaders pl WHERE pl.id = period_leader_id AND pl.leader_id = public.current_leader_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.period_leaders pl WHERE pl.id = period_leader_id AND pl.leader_id = public.current_leader_id()));
CREATE INDEX idx_leader_availability_pl ON public.leader_availability(period_leader_id);
CREATE TRIGGER trg_leader_availability_updated BEFORE UPDATE ON public.leader_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- schedule_posts
CREATE TABLE IF NOT EXISTS public.schedule_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.shift_schedules(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift_type_id uuid REFERENCES public.shift_types(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_hours numeric(4,2) NOT NULL,
  required_leaders integer NOT NULL DEFAULT 1 CHECK (required_leaders >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_main_session boolean NOT NULL DEFAULT false,
  is_night boolean NOT NULL DEFAULT false,
  is_breakfast boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_posts TO authenticated;
GRANT ALL ON public.schedule_posts TO service_role;
ALTER TABLE public.schedule_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_posts_admin_all" ON public.schedule_posts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "schedule_posts_published_read" ON public.schedule_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shift_schedules s WHERE s.id = schedule_id AND s.is_published = true));
CREATE INDEX idx_schedule_posts_schedule_date ON public.schedule_posts(schedule_id, date);
CREATE TRIGGER trg_schedule_posts_updated BEFORE UPDATE ON public.schedule_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- schedule_post_assignments
CREATE TABLE IF NOT EXISTS public.schedule_post_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.schedule_posts(id) ON DELETE CASCADE,
  period_leader_id uuid NOT NULL REFERENCES public.period_leaders(id) ON DELETE CASCADE,
  is_locked boolean NOT NULL DEFAULT false,
  assigned_manually boolean NOT NULL DEFAULT false,
  generator_run_id uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, period_leader_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_post_assignments TO authenticated;
GRANT ALL ON public.schedule_post_assignments TO service_role;
ALTER TABLE public.schedule_post_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spa_admin_all" ON public.schedule_post_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "spa_self_read" ON public.schedule_post_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.period_leaders pl WHERE pl.id = period_leader_id AND pl.leader_id = public.current_leader_id())
    OR EXISTS (
      SELECT 1 FROM public.schedule_posts sp
      JOIN public.shift_schedules ss ON ss.id = sp.schedule_id
      WHERE sp.id = post_id AND ss.is_published = true
    )
  );
CREATE INDEX idx_spa_post ON public.schedule_post_assignments(post_id);
CREATE INDEX idx_spa_pl ON public.schedule_post_assignments(period_leader_id);
CREATE TRIGGER trg_spa_updated BEFORE UPDATE ON public.schedule_post_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- schedule_generator_runs
CREATE TABLE IF NOT EXISTS public.schedule_generator_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.shift_schedules(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  run_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  keep_locked boolean NOT NULL DEFAULT true,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_generator_runs TO authenticated;
GRANT ALL ON public.schedule_generator_runs TO service_role;
ALTER TABLE public.schedule_generator_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sgr_admin_all" ON public.schedule_generator_runs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX idx_sgr_schedule ON public.schedule_generator_runs(schedule_id);
