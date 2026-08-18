DROP POLICY IF EXISTS chat_messages_insert_own_active ON public.chat_messages;
CREATE POLICY chat_messages_insert_own_active ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  leader_id = current_leader_id()
  AND (
    is_admin() OR is_superadmin()
    OR CASE
      WHEN channel = 'leirskole' THEN is_leirskole()
      WHEN channel = 'offseason' THEN true
      ELSE (NOT is_leirskole()) AND EXISTS (
        SELECT 1 FROM public.leaders l
        WHERE l.id = current_leader_id() AND l.is_active = true
      )
    END
  )
);

DROP POLICY IF EXISTS chat_messages_select_all_leaders ON public.chat_messages;
CREATE POLICY chat_messages_select_all_leaders ON public.chat_messages
FOR SELECT TO authenticated
USING (
  current_leader_id() IS NOT NULL
  AND (
    is_admin() OR is_superadmin()
    OR CASE
      WHEN channel = 'leirskole' THEN is_leirskole()
      WHEN channel = 'offseason' THEN true
      ELSE NOT is_leirskole()
    END
  )
);