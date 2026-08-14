CREATE TABLE public.leader_sips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  to_leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 1,
  message text,
  season_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  opened_at timestamp with time zone,
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX leader_sips_to_idx ON public.leader_sips (to_leader_id, created_at DESC);
CREATE INDEX leader_sips_from_idx ON public.leader_sips (from_leader_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.leader_sips TO authenticated;
GRANT ALL ON public.leader_sips TO service_role;

ALTER TABLE public.leader_sips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders see their own sips"
ON public.leader_sips FOR SELECT TO authenticated
USING (
  from_leader_id = public.current_leader_id()
  OR to_leader_id = public.current_leader_id()
  OR public.is_admin()
);

CREATE POLICY "Recipients can open their sips"
ON public.leader_sips FOR UPDATE TO authenticated
USING (to_leader_id = public.current_leader_id())
WITH CHECK (to_leader_id = public.current_leader_id());

CREATE OR REPLACE FUNCTION public.my_sips_left()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(10 - COALESCE((
    SELECT sum(s.amount)::int FROM public.leader_sips s
     WHERE s.from_leader_id = public.current_leader_id()
       AND s.season_year = EXTRACT(YEAR FROM now())::int
  ), 0), 0)
$$;

CREATE OR REPLACE FUNCTION public.give_sips(_to uuid, _amount integer, _message text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _left int;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _to IS NULL OR _to = _me THEN RAISE EXCEPTION 'Velg en annen leder'; END IF;
  IF _amount IS NULL OR _amount < 1 THEN RAISE EXCEPTION 'Minst 1 slurk'; END IF;

  SELECT public.my_sips_left() INTO _left;
  IF _amount > _left THEN
    RAISE EXCEPTION 'Du har bare % slurker igjen', _left;
  END IF;

  INSERT INTO public.leader_sips (from_leader_id, to_leader_id, amount, message)
  VALUES (_me, _to, _amount, NULLIF(trim(coalesce(_message, '')), ''))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;