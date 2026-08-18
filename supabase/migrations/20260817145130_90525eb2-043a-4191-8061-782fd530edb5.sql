CREATE TABLE public.leirskole_session_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  items TEXT[] NOT NULL DEFAULT '{}',
  assign_all BOOLEAN NOT NULL DEFAULT true,
  assigned_leader_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_session_info TO authenticated;
GRANT ALL ON public.leirskole_session_info TO service_role;

ALTER TABLE public.leirskole_session_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leirskole_session_info_admin" ON public.leirskole_session_info
  TO authenticated
  USING (is_admin() OR is_superadmin())
  WITH CHECK (is_admin() OR is_superadmin());

CREATE POLICY "leirskole_session_info_read_mine" ON public.leirskole_session_info
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leirskole_staff s
      WHERE s.week_id = leirskole_session_info.week_id
        AND s.leader_id = current_leader_id()
    )
    AND (assign_all OR current_leader_id() = ANY (assigned_leader_ids))
  );

CREATE TRIGGER trg_leirskole_session_info_upd
  BEFORE UPDATE ON public.leirskole_session_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.leirskole_session_info_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  info_id UUID NOT NULL REFERENCES public.leirskole_session_info(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (info_id, leader_id)
);

GRANT SELECT, INSERT, DELETE ON public.leirskole_session_info_reads TO authenticated;
GRANT ALL ON public.leirskole_session_info_reads TO service_role;

ALTER TABLE public.leirskole_session_info_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leirskole_info_reads_admin_select" ON public.leirskole_session_info_reads
  FOR SELECT TO authenticated
  USING (is_admin() OR is_superadmin() OR leader_id = current_leader_id());

CREATE POLICY "leirskole_info_reads_insert_own" ON public.leirskole_session_info_reads
  FOR INSERT TO authenticated
  WITH CHECK (leader_id = current_leader_id());

CREATE POLICY "leirskole_info_reads_delete_own" ON public.leirskole_session_info_reads
  FOR DELETE TO authenticated
  USING (leader_id = current_leader_id() OR is_admin() OR is_superadmin());