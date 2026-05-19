
-- Drop old trigger so we can replace it
DROP TRIGGER IF EXISTS trg_add_leader_to_trafikk ON public.leaders;
DROP FUNCTION IF EXISTS public.add_leader_to_trafikk();

-- Wipe all existing channels (members cascade)
DELETE FROM public.walkie_channels;

-- Create the three fixed channels
INSERT INTO public.walkie_channels (name, channel_type) VALUES
  ('Alle', 'custom'),
  ('1', 'custom'),
  ('2', 'custom');

-- Add every active leader to all three
INSERT INTO public.walkie_channel_members (channel_id, leader_id)
SELECT wc.id, l.id
FROM public.walkie_channels wc
CROSS JOIN public.leaders l
WHERE COALESCE(l.is_active, true) = true
ON CONFLICT DO NOTHING;

-- Trigger: when a new leader is inserted, add them to all walkie channels
CREATE OR REPLACE FUNCTION public.add_leader_to_all_walkie_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.is_active, true) THEN
    INSERT INTO public.walkie_channel_members (channel_id, leader_id)
    SELECT id, NEW.id FROM public.walkie_channels
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_leader_to_all_walkie_channels
AFTER INSERT ON public.leaders
FOR EACH ROW EXECUTE FUNCTION public.add_leader_to_all_walkie_channels();
