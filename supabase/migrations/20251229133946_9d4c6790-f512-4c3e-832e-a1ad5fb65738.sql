-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (leaders can read, admins can manage)
CREATE POLICY "Allow public read activities" 
ON public.activities 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert activities" 
ON public.activities 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update activities" 
ON public.activities 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete activities" 
ON public.activities 
FOR DELETE 
USING (true);

-- Insert existing activities with sort order
INSERT INTO public.activities (title, sort_order, is_active) VALUES
  ('Pil & Bue', 1, true),
  ('Svømming til Skrikeren en vei', 2, true),
  ('Svømming til Skrikeren begge veier', 3, true),
  ('Tube', 4, true),
  ('Tretten meter', 5, true),
  ('Åtte meter', 6, true),
  ('Ti meter', 7, true),
  ('Taubane', 8, true),
  ('Vannski', 9, true),
  ('Triatlon', 10, true),
  ('Klatring', 11, true),
  ('Skrikern', 12, true),
  ('Andre Aktiviteter', 13, true),
  ('Bruskasse', 14, true),
  ('Rappis', 15, true),
  ('Outboard', 16, true);