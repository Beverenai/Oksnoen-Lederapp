DROP POLICY IF EXISTS health_info_select ON public.participant_health_info;
CREATE POLICY health_info_select ON public.participant_health_info
FOR SELECT TO authenticated
USING (current_leader_id() IS NOT NULL);