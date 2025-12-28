-- Add sort_order to cabins
ALTER TABLE public.cabins 
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Add new columns to participants
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS room text,
ADD COLUMN IF NOT EXISTS times_attended integer DEFAULT 0;

-- Migrate existing name data to first_name and last_name
UPDATE public.participants 
SET 
  first_name = split_part(name, ' ', 1), 
  last_name = CASE 
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Create participant_health_info table for nurse-only health data
CREATE TABLE IF NOT EXISTS public.participant_health_info (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id uuid NOT NULL UNIQUE REFERENCES public.participants(id) ON DELETE CASCADE,
    info text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on participant_health_info
ALTER TABLE public.participant_health_info ENABLE ROW LEVEL SECURITY;

-- RLS policies for participant_health_info (nurse/admin only access enforced in app)
CREATE POLICY "Allow public read participant_health_info"
ON public.participant_health_info
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert participant_health_info"
ON public.participant_health_info
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update participant_health_info"
ON public.participant_health_info
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete participant_health_info"
ON public.participant_health_info
FOR DELETE
USING (true);

-- Create leader_cabins junction table
CREATE TABLE IF NOT EXISTS public.leader_cabins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
    cabin_id uuid NOT NULL REFERENCES public.cabins(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(leader_id, cabin_id)
);

-- Enable RLS on leader_cabins
ALTER TABLE public.leader_cabins ENABLE ROW LEVEL SECURITY;

-- RLS policies for leader_cabins
CREATE POLICY "Allow public read leader_cabins"
ON public.leader_cabins
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert leader_cabins"
ON public.leader_cabins
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update leader_cabins"
ON public.leader_cabins
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete leader_cabins"
ON public.leader_cabins
FOR DELETE
USING (true);

-- Add unique constraint on cabin name to prevent duplicates
ALTER TABLE public.cabins ADD CONSTRAINT cabins_name_unique UNIQUE (name);

-- Create trigger for updating participant_health_info updated_at
CREATE TRIGGER update_participant_health_info_updated_at
BEFORE UPDATE ON public.participant_health_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();