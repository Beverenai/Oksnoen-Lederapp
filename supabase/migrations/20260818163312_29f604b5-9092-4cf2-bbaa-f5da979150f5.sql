CREATE TABLE public.leirskole_week_leader_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id uuid NOT NULL REFERENCES public.leirskole_weeks(id) ON DELETE CASCADE,
  leader_id uuid,
  leader_name text NOT NULL,
  role_label text,
  competencies text[],
  shift_count integer NOT NULL DEFAULT 0,
  hours numeric NOT NULL DEFAULT 0,
  kitchen_days integer NOT NULL DEFAULT 0,
  kitchen_hours numeric NOT NULL DEFAULT 0,
  activity_count integer NOT NULL DEFAULT 0,
  activities text[],
  snapshot_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (week_id, leader_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leirskole_week_leader_snapshots TO authenticated;
GRANT ALL ON public.leirskole_week_leader_snapshots TO service_role;

ALTER TABLE public.leirskole_week_leader_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leirskole week snapshots"
ON public.leirskole_week_leader_snapshots FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Leaders view own leirskole week snapshots"
ON public.leirskole_week_leader_snapshots FOR SELECT TO authenticated
USING (leader_id = public.current_leader_id());

CREATE TRIGGER leirskole_week_leader_snapshots_updated_at
BEFORE UPDATE ON public.leirskole_week_leader_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.snapshot_leirskole_week(_week_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _n integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;
  IF _week_id IS NULL THEN
    RAISE EXCEPTION 'Ingen uke';
  END IF;

  INSERT INTO public.leirskole_week_leader_snapshots
    (week_id, leader_id, leader_name, role_label, competencies,
     shift_count, hours, kitchen_days, kitchen_hours, activity_count, activities, snapshot_at)
  SELECT _week_id,
         s.leader_id,
         COALESCE(l.name, 'Ukjent'),
         s.role_label,
         l.leirskole_competencies,
         COALESCE(sh.cnt, 0),
         COALESCE(sh.hours, 0),
         COALESCE(kd.cnt, 0),
         COALESCE(kd.hours, 0),
         COALESCE(ac.cnt, 0),
         ac.acts,
         now()
    FROM public.leirskole_staff s
    LEFT JOIN public.leaders l ON l.id = s.leader_id
    LEFT JOIN (
      SELECT a.staff_id, count(*)::int AS cnt, sum(p.duration_hours) AS hours
        FROM public.leirskole_assignments a
        JOIN public.leirskole_posts p ON p.id = a.post_id
       WHERE p.week_id = _week_id
       GROUP BY a.staff_id
    ) sh ON sh.staff_id = s.id
    LEFT JOIN (
      SELECT k.staff_id, count(*)::int AS cnt, sum(COALESCE(k.hours, 0)) AS hours
        FROM public.leirskole_kitchen_days k
       WHERE k.week_id = _week_id
       GROUP BY k.staff_id
    ) kd ON kd.staff_id = s.id
    LEFT JOIN (
      SELECT aa.leader_id, count(*)::int AS cnt, array_agg(aa.activity) AS acts
        FROM public.leirskole_activity_assignments aa
       WHERE aa.week_id = _week_id
       GROUP BY aa.leader_id
    ) ac ON ac.leader_id = s.leader_id
   WHERE s.week_id = _week_id
  ON CONFLICT (week_id, leader_id) DO UPDATE
    SET leader_name = EXCLUDED.leader_name,
        role_label = EXCLUDED.role_label,
        competencies = EXCLUDED.competencies,
        shift_count = EXCLUDED.shift_count,
        hours = EXCLUDED.hours,
        kitchen_days = EXCLUDED.kitchen_days,
        kitchen_hours = EXCLUDED.kitchen_hours,
        activity_count = EXCLUDED.activity_count,
        activities = EXCLUDED.activities,
        snapshot_at = EXCLUDED.snapshot_at,
        updated_at = now();

  SELECT count(*) INTO _n FROM public.leirskole_week_leader_snapshots WHERE week_id = _week_id;
  RETURN _n;
END;
$function$;