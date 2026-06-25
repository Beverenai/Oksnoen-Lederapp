DROP POLICY IF EXISTS part_activities_update ON public.participant_activities;
CREATE POLICY part_activities_update ON public.participant_activities
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS part_activities_delete ON public.participant_activities;
CREATE POLICY part_activities_delete ON public.participant_activities
  FOR DELETE TO authenticated
  USING (true);