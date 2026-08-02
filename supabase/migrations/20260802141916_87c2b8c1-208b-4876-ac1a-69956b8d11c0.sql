CREATE TABLE public.nurse_incident_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES public.participant_incidents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.leaders(id),
  reviewed_at timestamptz,
  mention_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_incident_reviews TO authenticated;
GRANT ALL ON public.nurse_incident_reviews TO service_role;

ALTER TABLE public.nurse_incident_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurse and admin can view incident reviews"
ON public.nurse_incident_reviews FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_nurse());

CREATE POLICY "Nurse and admin can create incident reviews"
ON public.nurse_incident_reviews FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_nurse());

CREATE POLICY "Nurse and admin can update incident reviews"
ON public.nurse_incident_reviews FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_nurse());

CREATE POLICY "Nurse and admin can delete incident reviews"
ON public.nurse_incident_reviews FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_nurse());

CREATE TRIGGER update_nurse_incident_reviews_updated_at
BEFORE UPDATE ON public.nurse_incident_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();