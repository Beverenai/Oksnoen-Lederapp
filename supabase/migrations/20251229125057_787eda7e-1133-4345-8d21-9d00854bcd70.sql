-- Create rope_controls table for safety checks
CREATE TABLE public.rope_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES public.leaders(id),
  activity TEXT NOT NULL,
  
  rope_status TEXT DEFAULT 'pending',
  rope_comment TEXT,
  
  harness_status TEXT DEFAULT 'pending',
  harness_comment TEXT,
  
  carabiner_status TEXT DEFAULT 'pending',
  carabiner_comment TEXT,
  
  helmet_status TEXT DEFAULT 'pending',
  helmet_comment TEXT,
  
  assigned_to UUID REFERENCES public.leaders(id),
  fix_comment TEXT,
  fixed_at TIMESTAMP WITH TIME ZONE,
  fixed_by UUID REFERENCES public.leaders(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rope_controls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read rope_controls" ON public.rope_controls FOR SELECT USING (true);
CREATE POLICY "Allow public insert rope_controls" ON public.rope_controls FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rope_controls" ON public.rope_controls FOR UPDATE USING (true);
CREATE POLICY "Allow public delete rope_controls" ON public.rope_controls FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_rope_controls_updated_at
BEFORE UPDATE ON public.rope_controls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();