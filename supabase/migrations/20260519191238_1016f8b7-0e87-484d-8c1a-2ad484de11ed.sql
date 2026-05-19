
-- Drop old auto triggers
DROP TRIGGER IF EXISTS trg_walkie_channel_for_cabin ON public.cabins;
DROP TRIGGER IF EXISTS trg_walkie_member_leader_cabin ON public.leader_cabins;
DROP TRIGGER IF EXISTS trg_add_leader_to_all_channel ON public.leaders;
DROP FUNCTION IF EXISTS public.create_walkie_channel_for_cabin();
DROP FUNCTION IF EXISTS public.sync_walkie_member_for_leader_cabin();
DROP FUNCTION IF EXISTS public.add_leader_to_all_channel();

-- Remove cabin + "all" channels (members cascade)
DELETE FROM public.walkie_channels WHERE channel_type IN ('cabin', 'all');

-- Create Trafikk channel
INSERT INTO public.walkie_channels (name, channel_type)
VALUES ('Trafikk', 'custom');

-- Add all active leaders
INSERT INTO public.walkie_channel_members (channel_id, leader_id)
SELECT wc.id, l.id
FROM public.walkie_channels wc
CROSS JOIN public.leaders l
WHERE wc.name = 'Trafikk' AND wc.channel_type = 'custom'
  AND COALESCE(l.is_active, true) = true
ON CONFLICT DO NOTHING;

-- New trigger: auto-add new leaders to Trafikk
CREATE OR REPLACE FUNCTION public.add_leader_to_trafikk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  SELECT id INTO v_channel_id FROM public.walkie_channels
    WHERE name = 'Trafikk' AND channel_type = 'custom' LIMIT 1;
  IF v_channel_id IS NOT NULL AND COALESCE(NEW.is_active, true) THEN
    INSERT INTO public.walkie_channel_members (channel_id, leader_id)
    VALUES (v_channel_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_leader_to_trafikk
AFTER INSERT ON public.leaders
FOR EACH ROW EXECUTE FUNCTION public.add_leader_to_trafikk();
