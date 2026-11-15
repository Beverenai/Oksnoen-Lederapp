CREATE TABLE IF NOT EXISTS public.period_leader_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, leader_id)
);

CREATE INDEX IF NOT EXISTS pla_period_idx ON public.period_leader_assignments (period_id);
CREATE INDEX IF NOT EXISTS pla_leader_idx ON public.period_leader_assignments (leader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_leader_assignments TO authenticated;
GRANT ALL ON public.period_leader_assignments TO service_role;

ALTER TABLE public.period_leader_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pla_admin_all ON public.period_leader_assignments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY pla_self_read ON public.period_leader_assignments
  FOR SELECT TO authenticated USING (leader_id = current_leader_id());

-- Bruk den nye tabellen i stedet for period_leaders
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

  SELECT count(*) INTO _n_setup FROM period_leader_assignments WHERE period_id = _period_id;

  IF _n_setup = 0 THEN
    RETURN jsonb_build_object('setup', 0, 'activated', 0, 'deactivated', 0);
  END IF;

  WITH up AS (
    UPDATE leaders l SET is_active = true, updated_at = now()
    WHERE l.deleted_at IS NULL
      AND l.is_active IS DISTINCT FROM true
      AND EXISTS (SELECT 1 FROM period_leader_assignments pl WHERE pl.period_id = _period_id AND pl.leader_id = l.id)
    RETURNING 1
  ) SELECT count(*) INTO _activated FROM up;

  WITH down AS (
    UPDATE leaders l SET is_active = false, updated_at = now()
    WHERE l.deleted_at IS NULL
      AND l.is_active IS DISTINCT FROM false
      AND l.is_external IS DISTINCT FROM true
      AND NOT has_role(l.id, 'superadmin')
      AND NOT EXISTS (SELECT 1 FROM period_leader_assignments pl WHERE pl.period_id = _period_id AND pl.leader_id = l.id)
    RETURNING 1
  ) SELECT count(*) INTO _deactivated FROM down;

  RETURN jsonb_build_object('setup', _n_setup, 'activated', _activated, 'deactivated', _deactivated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_period_leaders(uuid) TO authenticated;