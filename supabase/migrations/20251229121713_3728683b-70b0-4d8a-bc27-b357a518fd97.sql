-- Add target_group column to announcements table
ALTER TABLE public.announcements 
ADD COLUMN target_group text DEFAULT 'Alle ledere';