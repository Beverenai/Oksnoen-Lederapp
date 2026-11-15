-- QR-armbånd: et tøyarmbånd med et nummer kobles til en deltaker per periode,
-- og ledere skanner båndet for å registrere aktiviteter (også uten nett).

-- 1. Tildeling av bånd -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wristband_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[0-9]{1,10}$'),
  assigned_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text CHECK (release_reason IN ('byttet', 'mistet', 'feil', 'flyttet')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Et bånd kan bare sitte på én deltaker om gangen.
CREATE UNIQUE INDEX IF NOT EXISTS wristband_assignments_active_code
  ON public.wristband_assignments (code) WHERE released_at IS NULL;
-- En deltaker kan bare ha ett aktivt bånd.
CREATE UNIQUE INDEX IF NOT EXISTS wristband_assignments_active_participant
  ON public.wristband_assignments (participant_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS wristband_assignments_period
  ON public.wristband_assignments (period_id);
CREATE INDEX IF NOT EXISTS wristband_assignments_code_time
  ON public.wristband_assignments (code, assigned_at DESC);

ALTER TABLE public.wristband_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.wristband_assignments TO authenticated;
GRANT ALL ON public.wristband_assignments TO service_role;

-- Lesing for innloggede ledere. Skriving går bare gjennom funksjonene under.
CREATE POLICY "Leaders can view wristband assignments"
  ON public.wristband_assignments FOR SELECT TO authenticated
  USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admins delete wristband assignments"
  ON public.wristband_assignments FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_wristband_assignments_updated
  BEFORE UPDATE ON public.wristband_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wristband_assignments_period
  BEFORE INSERT ON public.wristband_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- 2. Skanninger lagres som vanlige aktiviteter -------------------------------
ALTER TABLE public.participant_activities
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'qr')),
  ADD COLUMN IF NOT EXISTS wristband_code text,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_scan_id uuid;

-- Samme skanning fra telefonen kan aldri bli registrert to ganger.
CREATE UNIQUE INDEX IF NOT EXISTS participant_activities_client_scan_id
  ON public.participant_activities (client_scan_id) WHERE client_scan_id IS NOT NULL;

-- 3. Hjelpefunksjon: bare sifre, uten ledende nuller --------------------------
CREATE OR REPLACE FUNCTION public.normalize_wristband_code(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(ltrim(regexp_replace(COALESCE(_code, ''), '\D', '', 'g'), '0'), '');
$$;

-- 4. Koble et bånd til en deltaker --------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_wristband(
  _participant_id uuid,
  _code text,
  _force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _c text := public.normalize_wristband_code(_code);
  _period uuid;
  _taken public.wristband_assignments%ROWTYPE;
  _taken_name text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _participant_id IS NULL THEN RAISE EXCEPTION 'Mangler deltaker'; END IF;
  IF _c IS NULL OR length(_c) > 10 THEN RAISE EXCEPTION 'Ugyldig båndnummer'; END IF;

  SELECT period_id INTO _period FROM public.participants WHERE id = _participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fant ikke deltakeren'; END IF;

  SELECT * INTO _taken FROM public.wristband_assignments
    WHERE code = _c AND released_at IS NULL
    FOR UPDATE;

  IF FOUND THEN
    IF _taken.participant_id = _participant_id THEN
      RETURN jsonb_build_object('status', 'uendret', 'code', _c);
    END IF;
    IF NOT _force THEN
      SELECT name INTO _taken_name FROM public.participants WHERE id = _taken.participant_id;
      RETURN jsonb_build_object(
        'status', 'opptatt',
        'code', _c,
        'participant_id', _taken.participant_id,
        'participant_name', _taken_name
      );
    END IF;
    UPDATE public.wristband_assignments
      SET released_at = now(), release_reason = 'flyttet'
      WHERE id = _taken.id;
  END IF;

  -- Deltakerens forrige bånd slutter å virke.
  UPDATE public.wristband_assignments
    SET released_at = now(), release_reason = 'byttet'
    WHERE participant_id = _participant_id AND released_at IS NULL;

  INSERT INTO public.wristband_assignments (period_id, participant_id, code, assigned_by)
  VALUES (_period, _participant_id, _c, _me);

  RETURN jsonb_build_object('status', 'koblet', 'code', _c);
END;
$$;

-- 5. Ta et bånd av en deltaker ------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_wristband(
  _participant_id uuid,
  _reason text DEFAULT 'mistet'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _n int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _reason NOT IN ('byttet', 'mistet', 'feil', 'flyttet') THEN _reason := 'mistet'; END IF;
  UPDATE public.wristband_assignments
    SET released_at = now(), release_reason = _reason
    WHERE participant_id = _participant_id AND released_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END;
$$;

-- 6. Ta imot skanninger fra telefonens lager -----------------------------------
-- Tar en liste med {client_scan_id, code, activity, scanned_at} og svarer med
-- én status per skanning: registrert | fantes | allerede_gjort | ukjent_band | ugyldig
CREATE OR REPLACE FUNCTION public.record_wristband_scans(_scans jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _it jsonb;
  _id uuid;
  _c text;
  _act text;
  _at timestamptz;
  _asg public.wristband_assignments%ROWTYPE;
  _out jsonb := '[]'::jsonb;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _scans IS NULL OR jsonb_typeof(_scans) <> 'array' THEN RETURN _out; END IF;
  IF jsonb_array_length(_scans) > 200 THEN RAISE EXCEPTION 'For mange skanninger i én sending'; END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_scans) LOOP
    BEGIN
      _id := (_it->>'client_scan_id')::uuid;
      _c := public.normalize_wristband_code(_it->>'code');
      _act := btrim(COALESCE(_it->>'activity', ''));
      _at := LEAST(COALESCE((_it->>'scanned_at')::timestamptz, now()), now());
    EXCEPTION WHEN others THEN
      _out := _out || jsonb_build_object('client_scan_id', _it->>'client_scan_id', 'status', 'ugyldig');
      CONTINUE;
    END;

    IF _id IS NULL OR _c IS NULL OR _act = '' OR length(_act) > 80 THEN
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'ugyldig');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.participant_activities WHERE client_scan_id = _id) THEN
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'fantes');
      CONTINUE;
    END IF;

    -- Hvem hadde båndet da det ble skannet? (skanningen kan komme inn senere)
    SELECT * INTO _asg FROM public.wristband_assignments
      WHERE code = _c
        AND assigned_at <= _at + interval '2 minutes'
        AND (released_at IS NULL OR released_at > _at)
      ORDER BY assigned_at DESC
      LIMIT 1;

    -- Båndet ble skannet før det var koblet: godta koblingen hvis den kom
    -- innen et døgn etterpå. Numre brukes aldri om igjen, så dette er trygt.
    IF NOT FOUND THEN
      SELECT * INTO _asg FROM public.wristband_assignments
        WHERE code = _c
          AND released_at IS NULL
          AND assigned_at <= _at + interval '24 hours'
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'ukjent_band');
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.participant_activities
      WHERE participant_id = _asg.participant_id AND lower(activity) = lower(_act)
    ) THEN
      _out := _out || jsonb_build_object(
        'client_scan_id', _id, 'status', 'allerede_gjort', 'participant_id', _asg.participant_id);
      CONTINUE;
    END IF;

    INSERT INTO public.participant_activities
      (participant_id, activity, registered_by, completed_at, period_id,
       source, wristband_code, scanned_at, client_scan_id)
    VALUES
      (_asg.participant_id, _act, _me, _at, _asg.period_id,
       'qr', _c, _at, _id);

    _out := _out || jsonb_build_object(
      'client_scan_id', _id, 'status', 'registrert', 'participant_id', _asg.participant_id);
  END LOOP;

  RETURN _out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_wristband(uuid, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.release_wristband(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_wristband_scans(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assign_wristband(uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_wristband(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_wristband_scans(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_wristband_code(text) TO authenticated, service_role;
