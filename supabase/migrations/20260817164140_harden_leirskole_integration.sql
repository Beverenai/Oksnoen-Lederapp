-- Persistent import rows let admins resolve people who cannot be matched safely.
CREATE TABLE public.leirskole_job_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  external_ref text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  role_label text,
  source_status text,
  availability jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(availability) = 'array'),
  linked_leader_id uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, external_ref)
);

CREATE INDEX leirskole_job_imports_week_idx
  ON public.leirskole_job_imports (week_id, linked_leader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_job_imports TO authenticated;
GRANT ALL ON public.leirskole_job_imports TO service_role;
ALTER TABLE public.leirskole_job_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leirskole_job_imports_admin"
  ON public.leirskole_job_imports
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_superadmin())
  WITH CHECK (public.is_admin() OR public.is_superadmin());

CREATE TRIGGER trg_leirskole_job_imports_upd
  BEFORE UPDATE ON public.leirskole_job_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS leirskole_staff_week_external_ref_key
  ON public.leirskole_staff (week_id, external_ref)
  WHERE external_ref IS NOT NULL;

ALTER TABLE public.leirskole_posts
  ADD COLUMN IF NOT EXISTS external_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS leirskole_posts_week_external_ref_key
  ON public.leirskole_posts (week_id, external_ref);

ALTER TABLE public.leirskole_assignments
  ADD COLUMN IF NOT EXISTS external_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS leirskole_assignments_external_ref_key
  ON public.leirskole_assignments (external_ref);

-- A staff assignment grants access automatically. The role is removed only
-- when the leader no longer belongs to any leirskole week.
CREATE OR REPLACE FUNCTION public.sync_leirskole_role_from_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_leader uuid;
  new_leader uuid;
BEGIN
  old_leader := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.leader_id ELSE NULL END;
  new_leader := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.leader_id ELSE NULL END;

  IF new_leader IS NOT NULL THEN
    INSERT INTO public.user_roles (leader_id, role)
    VALUES (new_leader, 'leirskole'::public.app_role)
    ON CONFLICT (leader_id, role) DO NOTHING;
  END IF;

  IF old_leader IS NOT NULL
     AND old_leader IS DISTINCT FROM new_leader
     AND NOT EXISTS (
       SELECT 1 FROM public.leirskole_staff s WHERE s.leader_id = old_leader
     ) THEN
    DELETE FROM public.user_roles
    WHERE leader_id = old_leader AND role = 'leirskole'::public.app_role;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_leirskole_staff_role ON public.leirskole_staff;
CREATE TRIGGER trg_leirskole_staff_role
  AFTER INSERT OR UPDATE OF leader_id OR DELETE ON public.leirskole_staff
  FOR EACH ROW EXECUTE FUNCTION public.sync_leirskole_role_from_staff();

INSERT INTO public.user_roles (leader_id, role)
SELECT DISTINCT leader_id, 'leirskole'::public.app_role
FROM public.leirskole_staff
ON CONFLICT (leader_id, role) DO NOTHING;

-- Keep manual import mapping and staff membership in one transaction so an
-- interrupted client request cannot leave the two tables disagreeing.
CREATE OR REPLACE FUNCTION public.link_leirskole_job_import(
  _import_id uuid,
  _leader_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  imported public.leirskole_job_imports%ROWTYPE;
  linked_staff_id uuid;
BEGIN
  IF NOT (public.is_admin() OR public.is_superadmin()) THEN
    RAISE EXCEPTION 'Kun admin kan koble leirskoleansatte' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO imported
  FROM public.leirskole_job_imports
  WHERE id = _import_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke personen fra jobbplattformen';
  END IF;

  IF imported.source_status IS DISTINCT FROM 'hired' THEN
    RAISE EXCEPTION 'Personen er ikke markert som ansatt';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leaders
    WHERE id = _leader_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Fant ikke appbrukeren';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leirskole_job_imports
    WHERE week_id = imported.week_id
      AND linked_leader_id = _leader_id
      AND id <> imported.id
  ) THEN
    RAISE EXCEPTION 'Appbrukeren er allerede koblet til en annen person denne uken';
  END IF;

  DELETE FROM public.leirskole_staff
  WHERE week_id = imported.week_id
    AND external_ref = imported.external_ref
    AND leader_id <> _leader_id;

  INSERT INTO public.leirskole_staff (week_id, leader_id, role_label, external_ref)
  VALUES (imported.week_id, _leader_id, imported.role_label, imported.external_ref)
  ON CONFLICT (week_id, leader_id) DO UPDATE
  SET role_label = COALESCE(EXCLUDED.role_label, leirskole_staff.role_label),
      external_ref = EXCLUDED.external_ref,
      updated_at = now()
  RETURNING id INTO linked_staff_id;

  DELETE FROM public.leirskole_availability
  WHERE staff_id = linked_staff_id;

  INSERT INTO public.leirskole_availability (staff_id, date, available, from_time, to_time)
  SELECT
    linked_staff_id,
    (entry->>'date')::date,
    COALESCE((entry->>'available')::boolean, true),
    NULLIF(entry->>'from_time', '')::time,
    NULLIF(entry->>'to_time', '')::time
  FROM jsonb_array_elements(imported.availability) AS entry
  WHERE entry ? 'date';

  UPDATE public.leirskole_job_imports
  SET linked_leader_id = _leader_id
  WHERE id = imported.id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_leirskole_job_import(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_leirskole_job_import(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_leirskole_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leirskole_staff s
    JOIN public.leirskole_weeks w ON w.id = s.week_id
    WHERE s.leader_id = public.current_leader_id()
      AND w.is_active = true
  )
$$;

-- Tasks are visible only to their recipients within a week they work.
DROP POLICY IF EXISTS "leirskole_tasks_read_mine" ON public.leirskole_tasks;
CREATE POLICY "leirskole_tasks_read_mine"
  ON public.leirskole_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leirskole_staff s
      WHERE s.week_id = leirskole_tasks.week_id
        AND s.leader_id = public.current_leader_id()
    )
    AND (
      assign_all
      OR public.current_leader_id() = ANY (assigned_leader_ids)
    )
  );

DROP POLICY IF EXISTS "leirskole_completions_read" ON public.leirskole_task_completions;
CREATE POLICY "leirskole_completions_read_own"
  ON public.leirskole_task_completions
  FOR SELECT TO authenticated
  USING (leader_id = public.current_leader_id());

DROP POLICY IF EXISTS "leirskole_completions_insert_own" ON public.leirskole_task_completions;
CREATE POLICY "leirskole_completions_insert_own"
  ON public.leirskole_task_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    leader_id = public.current_leader_id()
    AND EXISTS (
      SELECT 1
      FROM public.leirskole_tasks t
      JOIN public.leirskole_staff s
        ON s.week_id = t.week_id
       AND s.leader_id = public.current_leader_id()
      WHERE t.id = leirskole_task_completions.task_id
        AND (t.assign_all OR public.current_leader_id() = ANY (t.assigned_leader_ids))
    )
  );

-- The leirskole channel follows active staffing, not a role that may have been
-- granted for a future week.
DROP POLICY IF EXISTS "chat_messages_select_all_leaders" ON public.chat_messages;
CREATE POLICY "chat_messages_select_all_leaders"
  ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    public.current_leader_id() IS NOT NULL
    AND CASE
      WHEN channel = 'leirskole'
        THEN public.is_active_leirskole_staff() OR public.is_admin() OR public.is_superadmin()
      ELSE (NOT public.is_active_leirskole_staff()) OR public.is_admin() OR public.is_superadmin()
    END
  );

DROP POLICY IF EXISTS "chat_messages_insert_own_active" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own_active"
  ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    leader_id = public.current_leader_id()
    AND CASE
      WHEN channel = 'leirskole'
        THEN public.is_active_leirskole_staff() OR public.is_admin() OR public.is_superadmin()
      WHEN channel = 'offseason'
        THEN NOT public.is_active_leirskole_staff()
      ELSE (NOT public.is_active_leirskole_staff()) AND EXISTS (
        SELECT 1 FROM public.leaders l
        WHERE l.id = public.current_leader_id() AND l.is_active = true
      )
    END
  );
