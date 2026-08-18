-- 1) Svar og bilder på meldinger
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_body_check
  CHECK (length(body) <= 4000 AND (length(body) > 0 OR image_path IS NOT NULL));

CREATE INDEX IF NOT EXISTS chat_messages_reply_to_idx ON public.chat_messages (reply_to_id);

-- 2) Reaksjoner
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, leader_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.chat_message_reactions TO authenticated;
GRANT ALL ON public.chat_message_reactions TO service_role;

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_reactions_select_authenticated"
  ON public.chat_message_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "chat_reactions_insert_own"
  ON public.chat_message_reactions FOR INSERT TO authenticated
  WITH CHECK (leader_id = public.current_leader_id());

CREATE POLICY "chat_reactions_delete_own"
  ON public.chat_message_reactions FOR DELETE TO authenticated
  USING (leader_id = public.current_leader_id() OR public.is_superadmin());

CREATE INDEX IF NOT EXISTS chat_message_reactions_message_idx
  ON public.chat_message_reactions (message_id);

-- 3) Realtime
ALTER TABLE public.chat_message_reactions REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 4) Tilgang til bildelageret for chatten
DROP POLICY IF EXISTS "chat_images_read_authenticated" ON storage.objects;
CREATE POLICY "chat_images_read_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "chat_images_insert_own_folder" ON storage.objects;
CREATE POLICY "chat_images_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = public.current_leader_id()::text
  );

DROP POLICY IF EXISTS "chat_images_delete_own_folder" ON storage.objects;
CREATE POLICY "chat_images_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND ((storage.foldername(name))[1] = public.current_leader_id()::text OR public.is_superadmin())
  );