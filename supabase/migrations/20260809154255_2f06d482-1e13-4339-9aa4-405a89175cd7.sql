CREATE TABLE public.mailbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  sender_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  is_anonymous boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'question',
  content text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  read_at timestamptz,
  admin_reply text,
  replied_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mailbox_messages TO authenticated;
GRANT ALL ON public.mailbox_messages TO service_role;

ALTER TABLE public.mailbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders can insert own messages"
ON public.mailbox_messages FOR INSERT TO authenticated
WITH CHECK (sender_leader_id = public.current_leader_id());

CREATE POLICY "Senders and admins can read"
ON public.mailbox_messages FOR SELECT TO authenticated
USING (sender_leader_id = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Admins can update"
ON public.mailbox_messages FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete"
ON public.mailbox_messages FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX idx_mailbox_messages_period_created ON public.mailbox_messages (period_id, created_at DESC);
CREATE INDEX idx_mailbox_messages_sender ON public.mailbox_messages (sender_leader_id, created_at DESC);

CREATE TRIGGER set_period_id_mailbox_messages
BEFORE INSERT ON public.mailbox_messages
FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER update_mailbox_messages_updated_at
BEFORE UPDATE ON public.mailbox_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mailbox_messages;