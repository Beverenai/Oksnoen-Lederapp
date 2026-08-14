CREATE TABLE public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid references public.leaders(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'funksjon',
  status text not null default 'ny',
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_items TO authenticated;
GRANT ALL ON public.feedback_items TO service_role;
ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_select_all" ON public.feedback_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_insert_own" ON public.feedback_items FOR INSERT TO authenticated WITH CHECK (leader_id = public.current_leader_id() OR public.is_admin());
CREATE POLICY "feedback_update_own_or_admin" ON public.feedback_items FOR UPDATE TO authenticated USING (leader_id = public.current_leader_id() OR public.is_admin());
CREATE POLICY "feedback_delete_own_or_admin" ON public.feedback_items FOR DELETE TO authenticated USING (leader_id = public.current_leader_id() OR public.is_admin());

CREATE TRIGGER feedback_items_updated_at BEFORE UPDATE ON public.feedback_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feedback_votes (
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  leader_id uuid not null references public.leaders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (feedback_id, leader_id)
);

GRANT SELECT, INSERT, DELETE ON public.feedback_votes TO authenticated;
GRANT ALL ON public.feedback_votes TO service_role;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_votes_select_all" ON public.feedback_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_votes_insert_own" ON public.feedback_votes FOR INSERT TO authenticated WITH CHECK (leader_id = public.current_leader_id());
CREATE POLICY "feedback_votes_delete_own" ON public.feedback_votes FOR DELETE TO authenticated USING (leader_id = public.current_leader_id() OR public.is_admin());