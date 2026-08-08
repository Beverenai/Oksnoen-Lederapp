CREATE OR REPLACE FUNCTION public.get_season_participants()
RETURNS TABLE(
  id uuid,
  name text,
  first_name text,
  last_name text,
  birth_date date,
  cabin_id uuid,
  room text,
  image_url text,
  image_thumb_url text,
  has_arrived boolean,
  notes text,
  activity_notes text,
  times_attended integer,
  pass_written boolean,
  pass_text text,
  pass_suggestion text,
  team_id uuid,
  insj_points integer,
  period_id uuid,
  period_name text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.first_name, p.last_name, p.birth_date, p.cabin_id, p.room,
         p.image_url, p.image_thumb_url, p.has_arrived, p.notes, p.activity_notes,
         p.times_attended, p.pass_written, p.pass_text, p.pass_suggestion,
         p.team_id, p.insj_points, p.period_id, pe.name, p.created_at, p.updated_at
  FROM public.participants p
  LEFT JOIN public.periods pe ON pe.id = p.period_id
  WHERE public.is_admin() OR public.is_nurse()
  ORDER BY pe.name NULLS LAST, p.name
$$;