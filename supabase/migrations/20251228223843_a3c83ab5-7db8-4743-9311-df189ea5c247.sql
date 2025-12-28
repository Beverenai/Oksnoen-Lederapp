-- Add checkout/pass columns to participants table
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS pass_suggestion text,
ADD COLUMN IF NOT EXISTS pass_text text,
ADD COLUMN IF NOT EXISTS pass_written boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pass_written_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS pass_written_by uuid REFERENCES public.leaders(id);

-- Add checkout_enabled config if not exists
INSERT INTO public.app_config (key, value) 
VALUES ('checkout_enabled', 'false')
ON CONFLICT (key) DO NOTHING;