-- Create app_config table for storing global settings like webhook URL
CREATE TABLE public.app_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (admin-only in practice via app logic)
CREATE POLICY "Allow public read" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.app_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.app_config FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.app_config FOR DELETE USING (true);

-- Insert default webhook URL entry
INSERT INTO public.app_config (key, value) VALUES ('sync_webhook_url', '');