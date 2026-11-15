-- Data fra arkiverte/tidligere perioder skal kun være synlig for admin.
-- Ledere ser bare den aktive perioden.

DROP POLICY IF EXISTS "Authenticated can view all items" ON public.gjenglemt_items;
CREATE POLICY gjenglemt_items_select ON public.gjenglemt_items
  FOR SELECT TO authenticated
  USING (is_admin() OR period_id IS NULL OR period_id = get_active_period_id());

DROP POLICY IF EXISTS "Leaders can view kiosk sales" ON public.kiosk_sales;
CREATE POLICY kiosk_sales_select ON public.kiosk_sales
  FOR SELECT TO authenticated
  USING (is_admin() OR period_id IS NULL OR period_id = get_active_period_id());

DROP POLICY IF EXISTS "Leaders can view kiosk deposits" ON public.kiosk_deposits;
CREATE POLICY kiosk_deposits_select ON public.kiosk_deposits
  FOR SELECT TO authenticated
  USING (is_admin() OR period_id IS NULL OR period_id = get_active_period_id());

DROP POLICY IF EXISTS "Leader selects own, admin/nurse all" ON public.participant_incidents;
CREATE POLICY participant_incidents_select ON public.participant_incidents
  FOR SELECT TO authenticated
  USING (
    is_admin() OR is_nurse()
    OR (leader_id = current_leader_id() AND (period_id IS NULL OR period_id = get_active_period_id()))
  );

-- Sesongarkivering: lås periodene, lagre lederne, og deaktiver alle ikke-eksterne ledere
-- slik at kun admin ser den gamle sesongen i appen.
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
  _n int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan arkivere sesongen';
  END IF;

  FOR _p IN SELECT id FROM periods WHERE season_year = _season_year LOOP
    BEGIN
      _n := snapshot_period_leaders(_p.id);
      _leaders := _leaders + COALESCE(_n, 0);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    UPDATE periods SET archived_at = COALESCE(archived_at, now()), is_active = false WHERE id = _p.id;
    _periods := _periods + 1;
  END LOOP;

  RETURN jsonb_build_object('periods', _periods, 'leaders', _leaders);
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_season(int) TO authenticated;