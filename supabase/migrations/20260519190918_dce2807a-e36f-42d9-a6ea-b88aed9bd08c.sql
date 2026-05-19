
-- Walkie-talkie channels
CREATE TABLE public.walkie_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('cabin','team','all','custom')),
  cabin_id uuid REFERENCES public.cabins(id) ON DELETE CASCADE,
  team text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.walkie_channel_members (
  channel_id uuid NOT NULL REFERENCES public.walkie_channels(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  can_speak boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (channel_id, leader_id)
);

CREATE INDEX idx_walkie_members_leader ON public.walkie_channel_members(leader_id);
CREATE INDEX idx_walkie_channels_cabin ON public.walkie_channels(cabin_id);

ALTER TABLE public.walkie_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walkie_channel_members ENABLE ROW LEVEL SECURITY;

-- SELECT: medlemmer + admin/nurse ser alt
CREATE POLICY "channels_select" ON public.walkie_channels FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.is_nurse()
  OR id IN (SELECT channel_id FROM public.walkie_channel_members WHERE leader_id = public.current_leader_id())
);

CREATE POLICY "channels_admin_insert" ON public.walkie_channels FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
CREATE POLICY "channels_admin_update" ON public.walkie_channels FOR UPDATE TO authenticated
USING (public.is_admin());
CREATE POLICY "channels_admin_delete" ON public.walkie_channels FOR DELETE TO authenticated
USING (public.is_admin());

CREATE POLICY "members_select" ON public.walkie_channel_members FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.is_nurse() OR leader_id = public.current_leader_id()
);
CREATE POLICY "members_admin_insert" ON public.walkie_channel_members FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
CREATE POLICY "members_admin_update" ON public.walkie_channel_members FOR UPDATE TO authenticated
USING (public.is_admin());
CREATE POLICY "members_admin_delete" ON public.walkie_channel_members FOR DELETE TO authenticated
USING (public.is_admin());

-- Trigger: auto-opprett kanal når ny hytte legges til
CREATE OR REPLACE FUNCTION public.create_walkie_channel_for_cabin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.walkie_channels (name, channel_type, cabin_id)
  VALUES (NEW.name, 'cabin', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_walkie_channel_for_cabin
AFTER INSERT ON public.cabins
FOR EACH ROW EXECUTE FUNCTION public.create_walkie_channel_for_cabin();

-- Trigger: sync medlemskap når leder kobles til hytte
CREATE OR REPLACE FUNCTION public.sync_walkie_member_for_leader_cabin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_channel_id FROM public.walkie_channels
      WHERE cabin_id = NEW.cabin_id AND channel_type = 'cabin' LIMIT 1;
    IF v_channel_id IS NOT NULL THEN
      INSERT INTO public.walkie_channel_members (channel_id, leader_id)
      VALUES (v_channel_id, NEW.leader_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO v_channel_id FROM public.walkie_channels
      WHERE cabin_id = OLD.cabin_id AND channel_type = 'cabin' LIMIT 1;
    IF v_channel_id IS NOT NULL THEN
      DELETE FROM public.walkie_channel_members
        WHERE channel_id = v_channel_id AND leader_id = OLD.leader_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_walkie_member_leader_cabin
AFTER INSERT OR DELETE ON public.leader_cabins
FOR EACH ROW EXECUTE FUNCTION public.sync_walkie_member_for_leader_cabin();

-- Trigger: legg nye/aktiverte ledere inn i "Alle ledere"
CREATE OR REPLACE FUNCTION public.add_leader_to_all_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  SELECT id INTO v_channel_id FROM public.walkie_channels WHERE channel_type = 'all' LIMIT 1;
  IF v_channel_id IS NOT NULL AND COALESCE(NEW.is_active, true) THEN
    INSERT INTO public.walkie_channel_members (channel_id, leader_id)
    VALUES (v_channel_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_leader_to_all_channel
AFTER INSERT ON public.leaders
FOR EACH ROW EXECUTE FUNCTION public.add_leader_to_all_channel();

-- Seed: "Alle ledere"-kanal
INSERT INTO public.walkie_channels (name, channel_type) VALUES ('Alle ledere', 'all');

-- Seed: medlemmer i "Alle ledere" (alle aktive)
INSERT INTO public.walkie_channel_members (channel_id, leader_id)
SELECT c.id, l.id FROM public.walkie_channels c
CROSS JOIN public.leaders l
WHERE c.channel_type = 'all' AND COALESCE(l.is_active, true) = true
ON CONFLICT DO NOTHING;

-- Seed: kanal per eksisterende hytte
INSERT INTO public.walkie_channels (name, channel_type, cabin_id)
SELECT name, 'cabin', id FROM public.cabins;

-- Seed: medlemskap fra leader_cabins
INSERT INTO public.walkie_channel_members (channel_id, leader_id)
SELECT wc.id, lc.leader_id
FROM public.leader_cabins lc
JOIN public.walkie_channels wc ON wc.cabin_id = lc.cabin_id AND wc.channel_type = 'cabin'
ON CONFLICT DO NOTHING;

-- Seed: team-kanaler basert på unike teams
INSERT INTO public.walkie_channels (name, channel_type, team)
SELECT DISTINCT 'Team ' || team, 'team', team
FROM public.leaders
WHERE team IS NOT NULL AND team <> '' AND COALESCE(is_active, true) = true;

INSERT INTO public.walkie_channel_members (channel_id, leader_id)
SELECT wc.id, l.id
FROM public.leaders l
JOIN public.walkie_channels wc ON wc.team = l.team AND wc.channel_type = 'team'
WHERE l.team IS NOT NULL AND COALESCE(l.is_active, true) = true
ON CONFLICT DO NOTHING;
