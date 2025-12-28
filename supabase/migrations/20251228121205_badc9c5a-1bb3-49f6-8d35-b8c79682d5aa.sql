-- Add extra fields to leader_content table
ALTER TABLE public.leader_content
ADD COLUMN extra_1 text,
ADD COLUMN extra_2 text,
ADD COLUMN extra_3 text,
ADD COLUMN extra_4 text,
ADD COLUMN extra_5 text;

-- Create extra_fields_config table for admin to configure extra field display
CREATE TABLE public.extra_fields_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'info',
  is_visible boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extra_fields_config ENABLE ROW LEVEL SECURITY;

-- Create policies for extra_fields_config
CREATE POLICY "Allow public read" ON public.extra_fields_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.extra_fields_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.extra_fields_config FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.extra_fields_config FOR DELETE USING (true);

-- Insert default config for all 5 extra fields
INSERT INTO public.extra_fields_config (field_key, title, icon, is_visible, sort_order) VALUES
  ('extra_1', 'Ekstra 1', 'info', false, 1),
  ('extra_2', 'Ekstra 2', 'info', false, 2),
  ('extra_3', 'Ekstra 3', 'info', false, 3),
  ('extra_4', 'Ekstra 4', 'info', false, 4),
  ('extra_5', 'Ekstra 5', 'info', false, 5);

-- Add trigger for updated_at
CREATE TRIGGER update_extra_fields_config_updated_at
  BEFORE UPDATE ON public.extra_fields_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();