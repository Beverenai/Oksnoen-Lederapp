ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'period',
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_channel_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_channel_check CHECK (channel IN ('period','offseason'));

CREATE OR REPLACE FUNCTION public.set_chat_message_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.channel = 'period' THEN
    NEW.period_id := COALESCE(NEW.period_id, public.get_active_period_id());
  ELSE
    NEW.period_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_chat_message_scope_trg ON public.chat_messages;
CREATE TRIGGER set_chat_message_scope_trg
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.set_chat_message_scope();

CREATE INDEX IF NOT EXISTS chat_messages_channel_period_idx
  ON public.chat_messages (channel, period_id, created_at);

DROP POLICY IF EXISTS chat_messages_insert_own_active ON public.chat_messages;
CREATE POLICY chat_messages_insert_own_active
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  leader_id = public.current_leader_id()
  AND (
    channel = 'offseason'
    OR EXISTS (
      SELECT 1 FROM public.leaders l
      WHERE l.id = public.current_leader_id() AND l.is_active = true
    )
  )
);