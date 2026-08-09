ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE TABLE IF NOT EXISTS public.chat_mention_notifications (
  message_id uuid PRIMARY KEY REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.chat_mention_notifications TO service_role;

ALTER TABLE public.chat_mention_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_mention_notifications_no_client_access"
  ON public.chat_mention_notifications
  FOR SELECT
  TO authenticated
  USING (false);