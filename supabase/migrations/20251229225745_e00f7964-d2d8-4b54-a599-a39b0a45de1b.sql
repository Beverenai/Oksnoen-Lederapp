-- Drop existing public policies on participants table
DROP POLICY IF EXISTS "Allow public delete" ON public.participants;
DROP POLICY IF EXISTS "Allow public insert" ON public.participants;
DROP POLICY IF EXISTS "Allow public read" ON public.participants;
DROP POLICY IF EXISTS "Allow public update" ON public.participants;

-- Create restrictive policies that deny all public access
-- Data will only be accessible through edge functions using service role

CREATE POLICY "No public read access to participants" 
ON public.participants 
FOR SELECT 
USING (false);

CREATE POLICY "No public insert access to participants" 
ON public.participants 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "No public update access to participants" 
ON public.participants 
FOR UPDATE 
USING (false);

CREATE POLICY "No public delete access to participants" 
ON public.participants 
FOR DELETE 
USING (false);

-- Also restrict participant_health_info as it contains sensitive data
DROP POLICY IF EXISTS "Allow public delete participant_health_info" ON public.participant_health_info;
DROP POLICY IF EXISTS "Allow public insert participant_health_info" ON public.participant_health_info;
DROP POLICY IF EXISTS "Allow public read participant_health_info" ON public.participant_health_info;
DROP POLICY IF EXISTS "Allow public update participant_health_info" ON public.participant_health_info;

CREATE POLICY "No public read access to health info" 
ON public.participant_health_info 
FOR SELECT 
USING (false);

CREATE POLICY "No public insert access to health info" 
ON public.participant_health_info 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "No public update access to health info" 
ON public.participant_health_info 
FOR UPDATE 
USING (false);

CREATE POLICY "No public delete access to health info" 
ON public.participant_health_info 
FOR DELETE 
USING (false);

-- Restrict participant_activities as well
DROP POLICY IF EXISTS "Allow public delete" ON public.participant_activities;
DROP POLICY IF EXISTS "Allow public insert" ON public.participant_activities;
DROP POLICY IF EXISTS "Allow public read" ON public.participant_activities;
DROP POLICY IF EXISTS "Allow public update" ON public.participant_activities;

CREATE POLICY "No public read access to activities" 
ON public.participant_activities 
FOR SELECT 
USING (false);

CREATE POLICY "No public insert access to activities" 
ON public.participant_activities 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "No public update access to activities" 
ON public.participant_activities 
FOR UPDATE 
USING (false);

CREATE POLICY "No public delete access to activities" 
ON public.participant_activities 
FOR DELETE 
USING (false);