CREATE TABLE public.leader_match_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.leader_matches(id) ON DELETE CASCADE,
  sender_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lmm_match ON public.leader_match_messages(match_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_match_messages TO authenticated;
GRANT ALL ON public.leader_match_messages TO service_role;

ALTER TABLE public.leader_match_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_in_match(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leader_matches m
    WHERE m.id = _match_id
      AND (m.leader_a_id = public.current_leader_id() OR m.leader_b_id = public.current_leader_id())
  )
$$;

CREATE POLICY "Match participants can read messages"
ON public.leader_match_messages FOR SELECT TO authenticated
USING (public.is_in_match(match_id));

CREATE POLICY "Match participants can send messages"
ON public.leader_match_messages FOR INSERT TO authenticated
WITH CHECK (public.is_in_match(match_id) AND sender_leader_id = public.current_leader_id());

CREATE POLICY "Match participants can mark messages read"
ON public.leader_match_messages FOR UPDATE TO authenticated
USING (public.is_in_match(match_id));

CREATE POLICY "Senders can delete own messages"
ON public.leader_match_messages FOR DELETE TO authenticated
USING (sender_leader_id = public.current_leader_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.leader_match_messages;