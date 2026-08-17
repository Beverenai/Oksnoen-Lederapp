CREATE TABLE public.leirskole_activity_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  date date NOT NULL,
  session text NOT NULL DEFAULT 'formiddag',
  activity text NOT NULL,
  note text,
  auto_generated boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leader_id, date, session)
);

CREATE INDEX idx_laa_week_date ON public.leirskole_activity_assignments (week_id, date);
CREATE INDEX idx_laa_leader ON public.leirskole_activity_assignments (leader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_activity_assignments TO authenticated;
GRANT ALL ON public.leirskole_activity_assignments TO service_role;

ALTER TABLE public.leirskole_activity_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leirskole staff and admins can view activity assignments"
ON public.leirskole_activity_assignments FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_superadmin() OR public.is_leirskole() OR public.is_leirskole_week_member(week_id));

CREATE POLICY "Admins can insert activity assignments"
ON public.leirskole_activity_assignments FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_superadmin());

CREATE POLICY "Admins can update activity assignments"
ON public.leirskole_activity_assignments FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_superadmin());

CREATE POLICY "Admins can delete activity assignments"
ON public.leirskole_activity_assignments FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_superadmin());

CREATE TRIGGER update_leirskole_activity_assignments_updated_at
BEFORE UPDATE ON public.leirskole_activity_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();