CREATE TABLE public.leader_deviations (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.leaders(id) on delete cascade,
  period_id uuid references public.periods(id) on delete set null,
  kind text not null default 'overtime',
  hours numeric(5,2),
  occurred_on date not null default current_date,
  note text,
  created_by uuid references public.leaders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX leader_deviations_leader_idx ON public.leader_deviations(leader_id);
CREATE INDEX leader_deviations_period_idx ON public.leader_deviations(period_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_deviations TO authenticated;
GRANT ALL ON public.leader_deviations TO service_role;

ALTER TABLE public.leader_deviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view leader deviations" ON public.leader_deviations FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can create leader deviations" ON public.leader_deviations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update leader deviations" ON public.leader_deviations FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete leader deviations" ON public.leader_deviations FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER leader_deviations_set_period BEFORE INSERT ON public.leader_deviations FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
CREATE TRIGGER leader_deviations_updated_at BEFORE UPDATE ON public.leader_deviations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();