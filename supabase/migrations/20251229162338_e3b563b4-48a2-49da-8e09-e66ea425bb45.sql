-- Create stories table for storing stories that leaders can read to participants
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same pattern as activities table)
CREATE POLICY "Allow public read stories" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Allow public insert stories" ON public.stories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stories" ON public.stories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stories" ON public.stories FOR DELETE USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stories_updated_at
BEFORE UPDATE ON public.stories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();