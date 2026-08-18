CREATE OR REPLACE FUNCTION public.get_my_unread_badge(_leader_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT COALESCE(_leader_id, public.current_leader_id()) AS id
  )
  SELECT COALESCE((
    SELECT count(*) FROM public.mailbox_messages m, me
     WHERE m.sender_leader_id = me.id
       AND m.admin_reply IS NOT NULL
       AND m.reply_seen_at IS NULL
  ), 0)::int
  + COALESCE((
    SELECT count(*) FROM public.murder_kill_claims c
      JOIN public.murder_games g ON g.id = c.game_id, me
     WHERE c.status = 'pending' AND c.victim_leader_id = me.id
       AND g.period_id = public.get_active_period_id()
  ), 0)::int
$function$;