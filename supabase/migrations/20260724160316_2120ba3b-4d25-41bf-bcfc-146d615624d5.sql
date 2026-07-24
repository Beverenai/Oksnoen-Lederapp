CREATE TABLE public.leader_period_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'csv',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (leader_id, period_id)
);

CREATE INDEX idx_leader_period_history_leader ON public.leader_period_history(leader_id);
CREATE INDEX idx_leader_period_history_period ON public.leader_period_history(period_id);

GRANT SELECT ON public.leader_period_history TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leader_period_history TO authenticated;
GRANT ALL ON public.leader_period_history TO service_role;

ALTER TABLE public.leader_period_history ENABLE ROW LEVEL SECURITY;

-- Any signed-in leader can read history (used by the Lederpass component).
CREATE POLICY "leader_period_history_read_authenticated"
ON public.leader_period_history FOR SELECT TO authenticated USING (true);

-- Only admins/superadmins can write.
CREATE POLICY "leader_period_history_admin_insert"
ON public.leader_period_history FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "leader_period_history_admin_update"
ON public.leader_period_history FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "leader_period_history_admin_delete"
ON public.leader_period_history FOR DELETE TO authenticated
USING (public.is_admin());

CREATE TRIGGER trg_leader_period_history_updated_at
BEFORE UPDATE ON public.leader_period_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();