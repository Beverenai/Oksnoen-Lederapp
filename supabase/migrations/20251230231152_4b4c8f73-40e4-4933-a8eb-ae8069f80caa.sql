-- Deactivate "Andre Aktiviteter" in activities table
UPDATE public.activities 
SET is_active = false 
WHERE lower(title) = lower('Andre Aktiviteter');

-- Clean up existing registrations
DELETE FROM public.participant_activities 
WHERE lower(activity) = lower('Andre Aktiviteter');