-- Add unique constraint on participant name to prevent duplicates at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_unique_name 
ON public.participants (LOWER(name));