CREATE OR REPLACE FUNCTION public.add_external_leader(_name text, _gender text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := public.current_leader_id();
  _clean text := trim(coalesce(_name, ''));
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF length(_clean) < 2 THEN
    RAISE EXCEPTION 'Skriv et navn';
  END IF;
  IF length(_clean) > 80 THEN RAISE EXCEPTION 'Navnet er for langt'; END IF;
  IF _gender IS NOT NULL AND _gender NOT IN ('male','female') THEN
    RAISE EXCEPTION 'Ugyldig kjønn';
  END IF;

  SELECT id INTO _id FROM public.leaders
   WHERE is_external AND lower(name) = lower(_clean) LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  INSERT INTO public.leaders (name, is_active, is_external, gender, phone)
  VALUES (_clean, false, true, _gender, 'ext-' || replace(gen_random_uuid()::text, '-', ''))
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;