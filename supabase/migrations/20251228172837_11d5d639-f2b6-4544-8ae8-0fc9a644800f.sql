-- Add has_read column to leader_content table
ALTER TABLE public.leader_content ADD COLUMN has_read boolean DEFAULT false;

-- Enable realtime for leader_content to track changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.leader_content;