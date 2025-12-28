-- Roller enum
CREATE TYPE public.app_role AS ENUM ('admin', 'leader');

-- Ledere-tabell (enkel innlogging med telefonnummer)
CREATE TABLE public.leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cabin TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roller-tabell (separat for sikkerhet)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES public.leaders(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (leader_id, role)
);

-- Hytter
CREATE TABLE public.cabins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Deltakere (barn)
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_date DATE,
  cabin_id UUID REFERENCES public.cabins(id),
  image_url TEXT,
  has_arrived BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Aktiviteter deltakere har gjort
CREATE TABLE public.participant_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  activity TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- Innhold for leder-hjemskjerm (admin-styrt per leder)
CREATE TABLE public.leader_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES public.leaders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_activity TEXT,
  extra_activity TEXT,
  personal_notes TEXT,
  obs_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Felles aktiviteter (alle ledere ser)
CREATE TABLE public.session_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  time_slot TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Den store veggen (felles beskjeder)
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hjemskjerm-konfigurasjon (admin styrer hva som vises)
CREATE TABLE public.home_screen_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Sett inn standard hjemskjerm-elementer
INSERT INTO public.home_screen_config (element_key, label, is_visible, sort_order) VALUES
  ('current_activity', 'Aktivitet', true, 1),
  ('extra_activity', 'Ekstra aktivitet', true, 2),
  ('personal_notes', 'Notater til deg', true, 3),
  ('obs_message', 'OBS', true, 4),
  ('session_activities', 'Aktiviteter denne økten', true, 5);

-- Hjelpefunksjon for rollesjekk
CREATE OR REPLACE FUNCTION public.has_role(_leader_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE leader_id = _leader_id
      AND role = _role
  )
$$;

-- RLS policies
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_screen_config ENABLE ROW LEVEL SECURITY;

-- Alle kan lese (enkel app uten Supabase auth)
CREATE POLICY "Allow public read" ON public.leaders FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.cabins FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.participant_activities FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.leader_content FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.session_activities FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.home_screen_config FOR SELECT USING (true);

-- Alle kan skrive (admin-verifisering gjøres i app-logikk)
CREATE POLICY "Allow public insert" ON public.leaders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.leaders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.leaders FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.user_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.user_roles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.user_roles FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.cabins FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.cabins FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.cabins FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.participants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.participants FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.participant_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.participant_activities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.participant_activities FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.leader_content FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.leader_content FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.leader_content FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.session_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.session_activities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.session_activities FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.announcements FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.announcements FOR DELETE USING (true);

CREATE POLICY "Allow public insert" ON public.home_screen_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.home_screen_config FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.home_screen_config FOR DELETE USING (true);

-- Storage bucket for deltaker-bilder
INSERT INTO storage.buckets (id, name, public) VALUES ('participant-images', 'participant-images', true);

CREATE POLICY "Public read participant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'participant-images');

CREATE POLICY "Public upload participant images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'participant-images');

CREATE POLICY "Public update participant images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'participant-images');

CREATE POLICY "Public delete participant images"
ON storage.objects FOR DELETE
USING (bucket_id = 'participant-images');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leaders_updated_at
  BEFORE UPDATE ON public.leaders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leader_content_updated_at
  BEFORE UPDATE ON public.leader_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();