CREATE OR REPLACE FUNCTION public.give_sips(_to uuid, _amount integer, _message text DEFAULT NULL::text, _drink_type text DEFAULT 'beer')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := public.current_leader_id();
  _left int;
  _id uuid;
  _type text := coalesce(_drink_type, 'beer');
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF _to IS NULL OR _to = _me THEN RAISE EXCEPTION 'Velg en annen leder'; END IF;
  IF _amount IS NULL OR _amount < 1 THEN RAISE EXCEPTION 'Minst 1 slurk'; END IF;
  IF _type NOT IN ('beer','wine','drink') THEN _type := 'beer'; END IF;

  SELECT public.my_sips_left() INTO _left;
  IF _amount > _left THEN
    RAISE EXCEPTION 'Du har bare % slurker igjen', _left;
  END IF;

  INSERT INTO public.leader_sips (from_leader_id, to_leader_id, amount, message, drink_type)
  VALUES (_me, _to, _amount, NULLIF(trim(coalesce(_message, '')), ''), _type)
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;