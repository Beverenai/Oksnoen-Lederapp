-- Unik kobling leder <-> periode
CREATE UNIQUE INDEX IF NOT EXISTS period_leaders_period_leader_key
  ON public.period_leaders (period_id, leader_id);

CREATE INDEX IF NOT EXISTS period_leaders_period_idx ON public.period_leaders (period_id);

-- Aktiver lederne som er satt opp for en periode, sett resten i off-season.
CREATE OR REPLACE FUNCTION public.apply_period_leaders(_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n_setup int;
  _activated int;
  _deactivated int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan endre ledere for perioden';
  END IF;

  SELECT count(*) INTO _n_setup FROM period_leaders WHERE period_id = _period_id;

  -- Ingen oppsett for perioden: ikke rør noe.
  IF _n_setup = 0 THEN
    RETURN jsonb_build_object('setup', 0, 'activated', 0, 'deactivated', 0);
  END IF;

  WITH up AS (
    UPDATE leaders l SET is_active = true, updated_at = now()
    WHERE l.deleted_at IS NULL
      AND l.is_active IS DISTINCT FROM true
      AND EXISTS (SELECT 1 FROM period_leaders pl WHERE pl.period_id = _period_id AND pl.leader_id = l.id)
    RETURNING 1
  ) SELECT count(*) INTO _activated FROM up;

  WITH down AS (
    UPDATE leaders l SET is_active = false, updated_at = now()
    WHERE l.deleted_at IS NULL
      AND l.is_active IS DISTINCT FROM false
      AND l.is_external IS DISTINCT FROM true
      AND NOT has_role(l.id, 'superadmin')
      AND NOT EXISTS (SELECT 1 FROM period_leaders pl WHERE pl.period_id = _period_id AND pl.leader_id = l.id)
    RETURNING 1
  ) SELECT count(*) INTO _deactivated FROM down;

  RETURN jsonb_build_object('setup', _n_setup, 'activated', _activated, 'deactivated', _deactivated);
END;
$$;

-- Arkiver hele sesongen: frys ledere per periode og merk periodene arkivert.
CREATE OR REPLACE FUNCTION public.archive_season(_season_year int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p record;
  _periods int := 0;
  _leaders int := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan arkivere sesongen';
  END IF;

  FOR _p IN SELECT id FROM periods WHERE season_year = _season_year LOOP
    _leaders := _leaders + COALESCE(snapshot_period_leaders(_p.id), 0);
    _periods := _periods + 1;
  END LOOP;

  UPDATE periods
     SET archived_at = COALESCE(archived_at, now())
   WHERE season_year = _season_year;

  RETURN jsonb_build_object('periods', _periods, 'leaders', _leaders);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_period_leaders(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_season(int) TO authenticated;