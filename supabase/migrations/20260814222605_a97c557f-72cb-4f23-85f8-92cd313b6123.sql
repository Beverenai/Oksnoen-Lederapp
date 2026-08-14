-- POV rolls
CREATE TABLE public.pov_rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  shots_per_leader integer NOT NULL DEFAULT 10,
  reveal_at timestamptz,
  developed_at timestamptz,
  season_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pov_rolls_status_chk CHECK (status IN ('open','developed','closed')),
  CONSTRAINT pov_rolls_shots_chk CHECK (shots_per_leader BETWEEN 1 AND 100)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pov_rolls TO authenticated;
GRANT ALL ON public.pov_rolls TO service_role;
ALTER TABLE public.pov_rolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ledere kan se ruller" ON public.pov_rolls
  FOR SELECT TO authenticated USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admin kan lage ruller" ON public.pov_rolls
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin kan endre ruller" ON public.pov_rolls
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin kan slette ruller" ON public.pov_rolls
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER pov_rolls_updated_at BEFORE UPDATE ON public.pov_rolls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POV photos
CREATE TABLE public.pov_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id uuid NOT NULL REFERENCES public.pov_rolls(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pov_photos_roll_idx ON public.pov_photos(roll_id, taken_at);
CREATE INDEX pov_photos_leader_idx ON public.pov_photos(roll_id, leader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pov_photos TO authenticated;
GRANT ALL ON public.pov_photos TO service_role;
ALTER TABLE public.pov_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bilder synlige etter utvikling" ON public.pov_photos
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR (
      public.current_leader_id() IS NOT NULL
      AND hidden = false
      AND EXISTS (
        SELECT 1 FROM public.pov_rolls r
        WHERE r.id = pov_photos.roll_id AND r.status = 'developed'
      )
    )
  );
CREATE POLICY "Admin kan endre bilder" ON public.pov_photos
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin kan slette bilder" ON public.pov_photos
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER pov_photos_updated_at BEFORE UPDATE ON public.pov_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reactions
CREATE TABLE public.pov_photo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.pov_photos(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, leader_id)
);

GRANT SELECT, INSERT, DELETE ON public.pov_photo_reactions TO authenticated;
GRANT ALL ON public.pov_photo_reactions TO service_role;
ALTER TABLE public.pov_photo_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ledere kan se reaksjoner" ON public.pov_photo_reactions
  FOR SELECT TO authenticated USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Ledere kan reagere selv" ON public.pov_photo_reactions
  FOR INSERT TO authenticated WITH CHECK (leader_id = public.current_leader_id());
CREATE POLICY "Ledere kan fjerne egen reaksjon" ON public.pov_photo_reactions
  FOR DELETE TO authenticated USING (leader_id = public.current_leader_id() OR public.is_admin());

-- RPCs
CREATE OR REPLACE FUNCTION public.pov_current_roll()
RETURNS TABLE(id uuid, title text, status text, shots_per_leader integer,
              reveal_at timestamptz, developed_at timestamptz,
              photo_count integer, my_shots_left integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.title, r.status, r.shots_per_leader, r.reveal_at, r.developed_at,
         (SELECT count(*)::int FROM public.pov_photos p WHERE p.roll_id = r.id),
         GREATEST(r.shots_per_leader - (
            SELECT count(*)::int FROM public.pov_photos p
             WHERE p.roll_id = r.id AND p.leader_id = public.current_leader_id()
         ), 0)
    FROM public.pov_rolls r
   WHERE public.current_leader_id() IS NOT NULL
     AND r.status <> 'closed'
   ORDER BY (r.status = 'open') DESC, r.created_at DESC
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.pov_my_shots_left(_roll_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT GREATEST(r.shots_per_leader - (
      SELECT count(*)::int FROM public.pov_photos p
       WHERE p.roll_id = r.id AND p.leader_id = public.current_leader_id()
  ), 0)
  FROM public.pov_rolls r WHERE r.id = _roll_id
$$;

CREATE OR REPLACE FUNCTION public.pov_take_photo(_roll_id uuid, _storage_path text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _roll public.pov_rolls;
  _used int;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  SELECT * INTO _roll FROM public.pov_rolls WHERE id = _roll_id;
  IF _roll.id IS NULL THEN RAISE EXCEPTION 'Ingen film'; END IF;
  IF _roll.status <> 'open' THEN RAISE EXCEPTION 'Filmen er lukket'; END IF;

  SELECT count(*) INTO _used FROM public.pov_photos
   WHERE roll_id = _roll_id AND leader_id = _me;
  IF _used >= _roll.shots_per_leader THEN
    RAISE EXCEPTION 'Filmen er full';
  END IF;

  INSERT INTO public.pov_photos (roll_id, leader_id, storage_path)
  VALUES (_roll_id, _me, _storage_path)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pov_develop_roll(_roll_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Ikke tilgang'; END IF;
  UPDATE public.pov_rolls
     SET status = 'developed', developed_at = COALESCE(developed_at, now()), updated_at = now()
   WHERE id = _roll_id;
END;
$$;

-- Storage policies for pov-photos bucket
CREATE POLICY "Ledere kan laste opp POV-bilder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pov-photos' AND public.current_leader_id() IS NOT NULL);

CREATE POLICY "POV-bilder synlige etter utvikling"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pov-photos' AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pov_photos p
      JOIN public.pov_rolls r ON r.id = p.roll_id
      WHERE p.storage_path = storage.objects.name
        AND r.status = 'developed' AND p.hidden = false
        AND public.current_leader_id() IS NOT NULL
    )
  )
);

CREATE POLICY "Admin kan slette POV-bilder"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pov-photos' AND public.is_admin());