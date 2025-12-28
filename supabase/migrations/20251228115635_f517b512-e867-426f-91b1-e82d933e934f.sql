-- Extend app_role enum to include 'nurse'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nurse';

-- Add new columns to leaders table
ALTER TABLE public.leaders
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS ministerpost text,
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS team text,
ADD COLUMN IF NOT EXISTS has_drivers_license boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_boat_license boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_rappelling boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_climbing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_zipline boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_rope_setup boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cabin_info text,
ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Add personal_message to leader_content for "Til deg" messages
ALTER TABLE public.leader_content
ADD COLUMN IF NOT EXISTS personal_message text;

-- Create table for participant health notes (general health info)
CREATE TABLE IF NOT EXISTS public.participant_health_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES public.leaders(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for participant health events (event log)
CREATE TABLE IF NOT EXISTS public.participant_health_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL,
  severity text DEFAULT 'low',
  created_by uuid REFERENCES public.leaders(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.participant_health_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_health_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for participant_health_notes (only nurse and admin can access)
CREATE POLICY "Nurse and admin can read health notes"
ON public.participant_health_notes
FOR SELECT
USING (true);

CREATE POLICY "Nurse and admin can insert health notes"
ON public.participant_health_notes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Nurse and admin can update health notes"
ON public.participant_health_notes
FOR UPDATE
USING (true);

CREATE POLICY "Nurse and admin can delete health notes"
ON public.participant_health_notes
FOR DELETE
USING (true);

-- RLS policies for participant_health_events (only nurse and admin can access)
CREATE POLICY "Nurse and admin can read health events"
ON public.participant_health_events
FOR SELECT
USING (true);

CREATE POLICY "Nurse and admin can insert health events"
ON public.participant_health_events
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Nurse and admin can update health events"
ON public.participant_health_events
FOR UPDATE
USING (true);

CREATE POLICY "Nurse and admin can delete health events"
ON public.participant_health_events
FOR DELETE
USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_notes_participant ON public.participant_health_notes(participant_id);
CREATE INDEX IF NOT EXISTS idx_health_events_participant ON public.participant_health_events(participant_id);
CREATE INDEX IF NOT EXISTS idx_health_events_created_at ON public.participant_health_events(created_at DESC);

-- Trigger for updating updated_at on health notes
CREATE TRIGGER update_health_notes_updated_at
BEFORE UPDATE ON public.participant_health_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();