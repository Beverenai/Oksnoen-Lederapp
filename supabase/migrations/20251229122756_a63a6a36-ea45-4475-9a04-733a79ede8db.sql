-- Create fix_tasks table
CREATE TABLE public.fix_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title text NOT NULL,
  description text,
  location text,
  what_to_fix text,
  image_url text,
  
  -- Created by
  created_by uuid REFERENCES public.leaders(id),
  created_at timestamptz DEFAULT now(),
  
  -- Assignment (only admin can set)
  assigned_to uuid REFERENCES public.leaders(id),
  assigned_at timestamptz,
  admin_notes text,
  
  -- Status: 'pending', 'assigned', 'fixed'
  status text DEFAULT 'pending' NOT NULL,
  fixed_at timestamptz,
  fixed_by uuid REFERENCES public.leaders(id),
  
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fix_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies - All authenticated leaders can read
CREATE POLICY "Allow public read fix_tasks"
ON public.fix_tasks
FOR SELECT
USING (true);

-- All leaders can insert (create new fix tasks)
CREATE POLICY "Allow public insert fix_tasks"
ON public.fix_tasks
FOR INSERT
WITH CHECK (true);

-- All leaders can update (for marking as fixed, admin for assignment)
CREATE POLICY "Allow public update fix_tasks"
ON public.fix_tasks
FOR UPDATE
USING (true);

-- Allow delete
CREATE POLICY "Allow public delete fix_tasks"
ON public.fix_tasks
FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_fix_tasks_updated_at
BEFORE UPDATE ON public.fix_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for fix images
INSERT INTO storage.buckets (id, name, public)
VALUES ('fix-images', 'fix-images', true);

-- Storage policies for fix-images bucket
CREATE POLICY "Fix images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'fix-images');

CREATE POLICY "Leaders can upload fix images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'fix-images');

CREATE POLICY "Leaders can update fix images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'fix-images');

CREATE POLICY "Leaders can delete fix images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'fix-images');

-- Enable realtime for fix_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.fix_tasks;