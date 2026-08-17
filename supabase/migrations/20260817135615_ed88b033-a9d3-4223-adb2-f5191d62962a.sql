-- Helper: er innlogget leder en leirskole-leder?
CREATE OR REPLACE FUNCTION public.is_leirskole()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.leader_id = public.current_leader_id() AND ur.role = 'leirskole'::app_role
  )
$$;

-- Varighet i timer, håndterer vakter over midnatt
CREATE OR REPLACE FUNCTION public.leirskole_post_duration(_start time, _end time)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _end > _start THEN EXTRACT(EPOCH FROM (_end - _start)) / 3600.0
    ELSE EXTRACT(EPOCH FROM ((_end + interval '24 hours') - _start)) / 3600.0
  END;
$$;

-- 1. Uker
CREATE TABLE public.leirskole_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  schedule_published_at timestamptz,
  max_daily_hours numeric NOT NULL DEFAULT 8,
  min_rest_hours numeric NOT NULL DEFAULT 11,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_weeks TO authenticated;
GRANT ALL ON public.leirskole_weeks TO service_role;
ALTER TABLE public.leirskole_weeks ENABLE ROW LEVEL SECURITY;

-- 2. Bemanning
CREATE TABLE public.leirskole_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  max_daily_hours numeric,
  role_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, leader_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_staff TO authenticated;
GRANT ALL ON public.leirskole_staff TO service_role;
ALTER TABLE public.leirskole_staff ENABLE ROW LEVEL SECURITY;

-- 3. Poster
CREATE TABLE public.leirskole_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  post_type text NOT NULL DEFAULT 'other',
  start_time time NOT NULL,
  end_time time NOT NULL,
  crosses_midnight boolean NOT NULL DEFAULT false,
  duration_hours numeric NOT NULL DEFAULT 0,
  required_leaders int NOT NULL DEFAULT 1 CHECK (required_leaders >= 1),
  is_main_shift boolean NOT NULL DEFAULT false,
  is_night boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leirskole_posts_week_idx ON public.leirskole_posts(week_id, date, start_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_posts TO authenticated;
GRANT ALL ON public.leirskole_posts TO service_role;
ALTER TABLE public.leirskole_posts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.leirskole_posts_fill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.crosses_midnight := NEW.end_time <= NEW.start_time;
  NEW.duration_hours := public.leirskole_post_duration(NEW.start_time, NEW.end_time);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_leirskole_posts_fill
  BEFORE INSERT OR UPDATE ON public.leirskole_posts
  FOR EACH ROW EXECUTE FUNCTION public.leirskole_posts_fill();

-- 4. Generatorkjøringer
CREATE TABLE public.leirskole_generator_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  keep_locked boolean NOT NULL DEFAULT true,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_generator_runs TO authenticated;
GRANT ALL ON public.leirskole_generator_runs TO service_role;
ALTER TABLE public.leirskole_generator_runs ENABLE ROW LEVEL SECURITY;

-- 5. Vaktfordeling
CREATE TABLE public.leirskole_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.leirskole_posts(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.leirskole_staff(id) ON DELETE CASCADE,
  is_locked boolean NOT NULL DEFAULT false,
  assigned_manually boolean NOT NULL DEFAULT false,
  generator_run_id uuid REFERENCES public.leirskole_generator_runs(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, staff_id)
);
CREATE INDEX leirskole_assignments_post_idx ON public.leirskole_assignments(post_id);
CREATE INDEX leirskole_assignments_staff_idx ON public.leirskole_assignments(staff_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_assignments TO authenticated;
GRANT ALL ON public.leirskole_assignments TO service_role;
ALTER TABLE public.leirskole_assignments ENABLE ROW LEVEL SECURITY;

-- 6. Tilgjengelighet
CREATE TABLE public.leirskole_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.leirskole_staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  available boolean NOT NULL DEFAULT true,
  from_time time,
  to_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_availability TO authenticated;
GRANT ALL ON public.leirskole_availability TO service_role;
ALTER TABLE public.leirskole_availability ENABLE ROW LEVEL SECURITY;

-- 7. Oppgaver
CREATE TABLE public.leirskole_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  assign_all boolean NOT NULL DEFAULT true,
  assigned_leader_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_tasks TO authenticated;
GRANT ALL ON public.leirskole_tasks TO service_role;
ALTER TABLE public.leirskole_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leirskole_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.leirskole_tasks(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, leader_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_task_completions TO authenticated;
GRANT ALL ON public.leirskole_task_completions TO service_role;
ALTER TABLE public.leirskole_task_completions ENABLE ROW LEVEL SECURITY;

-- updated_at triggere
CREATE TRIGGER trg_leirskole_weeks_upd BEFORE UPDATE ON public.leirskole_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leirskole_staff_upd BEFORE UPDATE ON public.leirskole_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leirskole_assignments_upd BEFORE UPDATE ON public.leirskole_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leirskole_availability_upd BEFORE UPDATE ON public.leirskole_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leirskole_tasks_upd BEFORE UPDATE ON public.leirskole_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: admin/superadmin full tilgang
CREATE POLICY "leirskole_weeks_admin" ON public.leirskole_weeks FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_staff_admin" ON public.leirskole_staff FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_posts_admin" ON public.leirskole_posts FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_assignments_admin" ON public.leirskole_assignments FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_runs_admin" ON public.leirskole_generator_runs FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_availability_admin" ON public.leirskole_availability FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_tasks_admin" ON public.leirskole_tasks FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "leirskole_completions_admin" ON public.leirskole_task_completions FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());

-- RLS: leirskole-ledere
CREATE POLICY "leirskole_weeks_read_own" ON public.leirskole_weeks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leirskole_staff s
    WHERE s.week_id = leirskole_weeks.id AND s.leader_id = public.current_leader_id()
  ));

CREATE POLICY "leirskole_staff_read_own_week" ON public.leirskole_staff FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leirskole_staff mine
    WHERE mine.week_id = leirskole_staff.week_id AND mine.leader_id = public.current_leader_id()
  ));

CREATE POLICY "leirskole_posts_read_published" ON public.leirskole_posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leirskole_weeks w
    JOIN public.leirskole_staff s ON s.week_id = w.id AND s.leader_id = public.current_leader_id()
    WHERE w.id = leirskole_posts.week_id AND w.schedule_published_at IS NOT NULL
  ));

CREATE POLICY "leirskole_assignments_read_published" ON public.leirskole_assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leirskole_posts p
    JOIN public.leirskole_weeks w ON w.id = p.week_id
    JOIN public.leirskole_staff s ON s.week_id = w.id AND s.leader_id = public.current_leader_id()
    WHERE p.id = leirskole_assignments.post_id AND w.schedule_published_at IS NOT NULL
  ));

CREATE POLICY "leirskole_availability_own" ON public.leirskole_availability FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leirskole_staff s
    WHERE s.id = leirskole_availability.staff_id AND s.leader_id = public.current_leader_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leirskole_staff s
    WHERE s.id = leirskole_availability.staff_id AND s.leader_id = public.current_leader_id()
  ));

CREATE POLICY "leirskole_tasks_read_mine" ON public.leirskole_tasks FOR SELECT TO authenticated
  USING (
    public.is_leirskole() AND (
      assign_all OR public.current_leader_id() = ANY (assigned_leader_ids)
    )
  );

CREATE POLICY "leirskole_completions_read" ON public.leirskole_task_completions FOR SELECT TO authenticated
  USING (public.is_leirskole());
CREATE POLICY "leirskole_completions_insert_own" ON public.leirskole_task_completions FOR INSERT TO authenticated
  WITH CHECK (leader_id = public.current_leader_id());
CREATE POLICY "leirskole_completions_delete_own" ON public.leirskole_task_completions FOR DELETE TO authenticated
  USING (leader_id = public.current_leader_id());

-- Chat: egen leirskole-kanal
DROP POLICY IF EXISTS "chat_messages_select_all_leaders" ON public.chat_messages;
CREATE POLICY "chat_messages_select_all_leaders" ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.current_leader_id() IS NOT NULL
    AND CASE
      WHEN channel = 'leirskole' THEN public.is_leirskole() OR public.is_admin() OR public.is_superadmin()
      ELSE (NOT public.is_leirskole()) OR public.is_admin() OR public.is_superadmin()
    END
  );

DROP POLICY IF EXISTS "chat_messages_insert_own_active" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own_active" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    leader_id = public.current_leader_id()
    AND CASE
      WHEN channel = 'leirskole' THEN public.is_leirskole() OR public.is_admin() OR public.is_superadmin()
      WHEN channel = 'offseason' THEN NOT public.is_leirskole()
      ELSE (NOT public.is_leirskole()) AND EXISTS (
        SELECT 1 FROM public.leaders l WHERE l.id = public.current_leader_id() AND l.is_active = true
      )
    END
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.leirskole_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leirskole_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leirskole_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leirskole_task_completions;