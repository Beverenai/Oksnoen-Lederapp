DROP POLICY IF EXISTS "Users can delete their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Superadmins can delete messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Leaders can delete own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Delete own or superadmin" ON public.chat_messages;
REVOKE DELETE ON public.chat_messages FROM authenticated;
REVOKE DELETE ON public.chat_messages FROM anon;