CREATE TABLE public.leirskole_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text NOT NULL DEFAULT '•',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_activity_types TO authenticated;
GRANT ALL ON public.leirskole_activity_types TO service_role;

ALTER TABLE public.leirskole_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle innloggede kan lese aktivitetstyper"
ON public.leirskole_activity_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin kan legge til aktivitetstyper"
ON public.leirskole_activity_types FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE POLICY "Admin kan endre aktivitetstyper"
ON public.leirskole_activity_types FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE POLICY "Admin kan slette aktivitetstyper"
ON public.leirskole_activity_types FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE TRIGGER update_leirskole_activity_types_updated_at
BEFORE UPDATE ON public.leirskole_activity_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.leirskole_activity_types (key, label, emoji, sort_order) VALUES
  ('tube', 'Tube', '🛞', 0),
  ('klatring', 'Klatring', '🧗', 1),
  ('rappellering', 'Rappellering', '🪢', 2),
  ('kanotur', 'Kanotur', '🛶', 3),
  ('batkjoring', 'Båtkjøring', '🚤', 4),
  ('badevakt', 'Badevakt', '🏊', 5);

CREATE TABLE public.leirskole_session_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  date date NOT NULL,
  session text NOT NULL,
  activity_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, date, session)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_session_activities TO authenticated;
GRANT ALL ON public.leirskole_session_activities TO service_role;

ALTER TABLE public.leirskole_session_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle innloggede kan lese valgte aktiviteter"
ON public.leirskole_session_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin kan legge til valgte aktiviteter"
ON public.leirskole_session_activities FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE POLICY "Admin kan endre valgte aktiviteter"
ON public.leirskole_session_activities FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE POLICY "Admin kan slette valgte aktiviteter"
ON public.leirskole_session_activities FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_superadmin() OR public.is_leirskole());

CREATE TRIGGER update_leirskole_session_activities_updated_at
BEFORE UPDATE ON public.leirskole_session_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();