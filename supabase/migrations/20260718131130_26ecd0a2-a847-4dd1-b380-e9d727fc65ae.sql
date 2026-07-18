
-- Incidents table
CREATE TABLE public.participant_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'annet',
  severity text NOT NULL DEFAULT 'low',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_incidents TO authenticated;
GRANT ALL ON public.participant_incidents TO service_role;

ALTER TABLE public.participant_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leader selects own or admin all"
  ON public.participant_incidents FOR SELECT TO authenticated
  USING (leader_id = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Leader inserts own"
  ON public.participant_incidents FOR INSERT TO authenticated
  WITH CHECK (leader_id = public.current_leader_id());

CREATE POLICY "Leader updates own or admin all"
  ON public.participant_incidents FOR UPDATE TO authenticated
  USING (leader_id = public.current_leader_id() OR public.is_admin())
  WITH CHECK (leader_id = public.current_leader_id() OR public.is_admin());

CREATE POLICY "Leader deletes own or admin all"
  ON public.participant_incidents FOR DELETE TO authenticated
  USING (leader_id = public.current_leader_id() OR public.is_admin());

CREATE TRIGGER set_period_id_default_trg
  BEFORE INSERT ON public.participant_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER update_updated_at
  BEFORE UPDATE ON public.participant_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Join table
CREATE TABLE public.participant_incident_participants (
  incident_id uuid NOT NULL REFERENCES public.participant_incidents(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, participant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_incident_participants TO authenticated;
GRANT ALL ON public.participant_incident_participants TO service_role;

ALTER TABLE public.participant_incident_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access if parent visible"
  ON public.participant_incident_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.participant_incidents i
    WHERE i.id = incident_id
      AND (i.leader_id = public.current_leader_id() OR public.is_admin())
  ));

CREATE POLICY "Insert if parent owned or admin"
  ON public.participant_incident_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.participant_incidents i
    WHERE i.id = incident_id
      AND (i.leader_id = public.current_leader_id() OR public.is_admin())
  ));

CREATE POLICY "Delete if parent owned or admin"
  ON public.participant_incident_participants FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.participant_incidents i
    WHERE i.id = incident_id
      AND (i.leader_id = public.current_leader_id() OR public.is_admin())
  ));

CREATE INDEX idx_incident_participants_participant ON public.participant_incident_participants(participant_id);
CREATE INDEX idx_incidents_period ON public.participant_incidents(period_id);
CREATE INDEX idx_incidents_leader ON public.participant_incidents(leader_id);
