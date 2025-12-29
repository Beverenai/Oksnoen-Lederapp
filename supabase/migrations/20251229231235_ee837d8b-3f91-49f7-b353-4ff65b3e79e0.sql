-- Fjern restriktive policier for participants
DROP POLICY IF EXISTS "No public read access to participants" ON public.participants;
DROP POLICY IF EXISTS "No public insert access to participants" ON public.participants;
DROP POLICY IF EXISTS "No public update access to participants" ON public.participants;
DROP POLICY IF EXISTS "No public delete access to participants" ON public.participants;

-- Fjern restriktive policier for participant_activities
DROP POLICY IF EXISTS "No public read access to activities" ON public.participant_activities;
DROP POLICY IF EXISTS "No public insert access to activities" ON public.participant_activities;
DROP POLICY IF EXISTS "No public update access to activities" ON public.participant_activities;
DROP POLICY IF EXISTS "No public delete access to activities" ON public.participant_activities;

-- Fjern restriktive policier for participant_health_info
DROP POLICY IF EXISTS "No public read access to health info" ON public.participant_health_info;
DROP POLICY IF EXISTS "No public insert access to health info" ON public.participant_health_info;
DROP POLICY IF EXISTS "No public update access to health info" ON public.participant_health_info;
DROP POLICY IF EXISTS "No public delete access to health info" ON public.participant_health_info;

-- Legg til tillatende policier for participants
CREATE POLICY "Allow public read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update participants" ON public.participants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete participants" ON public.participants FOR DELETE USING (true);

-- Legg til tillatende policier for participant_activities
CREATE POLICY "Allow public read activities" ON public.participant_activities FOR SELECT USING (true);
CREATE POLICY "Allow public insert activities" ON public.participant_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update activities" ON public.participant_activities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete activities" ON public.participant_activities FOR DELETE USING (true);

-- Legg til tillatende policier for participant_health_info
CREATE POLICY "Allow public read health info" ON public.participant_health_info FOR SELECT USING (true);
CREATE POLICY "Allow public insert health info" ON public.participant_health_info FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update health info" ON public.participant_health_info FOR UPDATE USING (true);
CREATE POLICY "Allow public delete health info" ON public.participant_health_info FOR DELETE USING (true);