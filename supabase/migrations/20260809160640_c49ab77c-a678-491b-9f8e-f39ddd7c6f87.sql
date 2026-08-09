CREATE TABLE public.leader_hookups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE,
  leader_a_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  leader_b_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leader_hookups_status_check CHECK (status IN ('pending','confirmed','declined')),
  CONSTRAINT leader_hookups_distinct_check CHECK (leader_a_id <> leader_b_id),
  CONSTRAINT leader_hookups_order_check CHECK (leader_a_id < leader_b_id)
);

CREATE UNIQUE INDEX leader_hookups_unique_pair
  ON public.leader_hookups (period_id, leader_a_id, leader_b_id);

CREATE INDEX leader_hookups_a_idx ON public.leader_hookups (leader_a_id);
CREATE INDEX leader_hookups_b_idx ON public.leader_hookups (leader_b_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_hookups TO authenticated;
GRANT ALL ON public.leader_hookups TO service_role;

ALTER TABLE public.leader_hookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Confirmed hookups visible to all leaders"
  ON public.leader_hookups FOR SELECT TO authenticated
  USING (
    status = 'confirmed'
    OR leader_a_id = public.current_leader_id()
    OR leader_b_id = public.current_leader_id()
    OR public.is_admin()
  );

CREATE POLICY "Leaders can request their own hookups"
  ON public.leader_hookups FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = public.current_leader_id()
    AND public.current_leader_id() IN (leader_a_id, leader_b_id)
    AND status = 'pending'
  );

CREATE POLICY "Counterpart can respond to hookup"
  ON public.leader_hookups FOR UPDATE TO authenticated
  USING (
    public.current_leader_id() IN (leader_a_id, leader_b_id)
    AND public.current_leader_id() <> requested_by
  )
  WITH CHECK (
    public.current_leader_id() IN (leader_a_id, leader_b_id)
  );

CREATE POLICY "Involved leaders or admin can delete hookup"
  ON public.leader_hookups FOR DELETE TO authenticated
  USING (
    public.current_leader_id() IN (leader_a_id, leader_b_id)
    OR public.is_admin()
  );

CREATE TRIGGER set_period_id_leader_hookups
  BEFORE INSERT ON public.leader_hookups
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER update_leader_hookups_updated_at
  BEFORE UPDATE ON public.leader_hookups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();