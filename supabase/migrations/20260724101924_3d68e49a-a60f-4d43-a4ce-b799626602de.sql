
-- 1. periods.archived_at
ALTER TABLE public.periods ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_period_archived_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false AND NEW.archived_at IS NULL THEN
    NEW.archived_at = now();
  END IF;
  IF NEW.is_active = true THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_period_archived_at ON public.periods;
CREATE TRIGGER trg_set_period_archived_at
  BEFORE UPDATE ON public.periods
  FOR EACH ROW EXECUTE FUNCTION public.set_period_archived_at();

-- 2. chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_created_at_idx ON public.chat_messages (created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_all_leaders"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.current_leader_id() IS NOT NULL);

CREATE POLICY "chat_messages_insert_own_active"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    leader_id = public.current_leader_id()
    AND EXISTS (
      SELECT 1 FROM public.leaders l
      WHERE l.id = public.current_leader_id() AND l.is_active = true
    )
  );

CREATE POLICY "chat_messages_delete_own_or_superadmin"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    leader_id = public.current_leader_id() OR public.is_superadmin()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
