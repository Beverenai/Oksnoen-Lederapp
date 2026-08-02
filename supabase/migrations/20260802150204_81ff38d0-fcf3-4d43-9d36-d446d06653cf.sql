DROP POLICY "Leader selects own or admin all" ON public.participant_incidents;
CREATE POLICY "Leader selects own, admin/nurse all" ON public.participant_incidents
FOR SELECT TO authenticated
USING (leader_id = public.current_leader_id() OR public.is_admin() OR public.is_nurse());

DROP POLICY "Access if parent visible" ON public.participant_incident_participants;
CREATE POLICY "Access if parent visible" ON public.participant_incident_participants
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.participant_incidents i
  WHERE i.id = participant_incident_participants.incident_id
    AND (i.leader_id = public.current_leader_id() OR public.is_admin() OR public.is_nurse())
));