CREATE TABLE public.period_leader_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  leader_id uuid,
  leader_name text NOT NULL,
  gender text,
  is_active boolean,
  is_external boolean,
  cabins text,
  teams text,
  roles text,
  snapshot_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (period_id, leader_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_leader_snapshots TO authenticated;
GRANT ALL ON public.period_leader_snapshots TO service_role;

ALTER TABLE public.period_leader_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read leader snapshots"
  ON public.period_leader_snapshots FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_nurse());

CREATE POLICY "Admins can write leader snapshots"
  ON public.period_leader_snapshots FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_period_leader_snapshots_updated
  BEFORE UPDATE ON public.period_leader_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.snapshot_period_leaders(_period_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid := COALESCE(_period_id, public.get_active_period_id());
  _n integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;
  IF _pid IS NULL THEN
    RAISE EXCEPTION 'Ingen periode';
  END IF;

  INSERT INTO public.period_leader_snapshots
    (period_id, leader_id, leader_name, gender, is_active, is_external, cabins, teams, roles, snapshot_at)
  SELECT _pid, l.id, l.name, l.gender, l.is_active, l.is_external,
         (SELECT string_agg(c.name, ', ' ORDER BY c.name)
            FROM public.leader_cabins lc
            JOIN public.cabins c ON c.id = lc.cabin_id
           WHERE lc.leader_id = l.id),
         (SELECT string_agg(lt.team_name, ', ')
            FROM public.leader_teams lt
           WHERE lt.leader_id = l.id),
         (SELECT string_agg(ur.role::text, ', ' ORDER BY ur.role::text)
            FROM public.user_roles ur
           WHERE ur.leader_id = l.id),
         now()
    FROM public.leaders l
   WHERE l.is_active = true OR EXISTS (
     SELECT 1 FROM public.leader_cabins lc WHERE lc.leader_id = l.id
   )
  ON CONFLICT (period_id, leader_id) DO UPDATE
    SET leader_name = EXCLUDED.leader_name,
        gender = EXCLUDED.gender,
        is_active = EXCLUDED.is_active,
        is_external = EXCLUDED.is_external,
        cabins = EXCLUDED.cabins,
        teams = EXCLUDED.teams,
        roles = EXCLUDED.roles,
        snapshot_at = EXCLUDED.snapshot_at,
        updated_at = now();

  SELECT count(*) INTO _n FROM public.period_leader_snapshots WHERE period_id = _pid;
  RETURN _n;
END;
$$;