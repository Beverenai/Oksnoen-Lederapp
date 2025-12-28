-- Create cabin_reports table for storing reports per cabin
CREATE TABLE public.cabin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabin_id UUID NOT NULL REFERENCES public.cabins(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
  UNIQUE(cabin_id)
);

-- Enable RLS
ALTER TABLE public.cabin_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read cabin_reports" ON public.cabin_reports FOR SELECT USING (true);
CREATE POLICY "Allow public insert cabin_reports" ON public.cabin_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update cabin_reports" ON public.cabin_reports FOR UPDATE USING (true);
CREATE POLICY "Allow public delete cabin_reports" ON public.cabin_reports FOR DELETE USING (true);