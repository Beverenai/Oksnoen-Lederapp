
CREATE OR REPLACE FUNCTION public.bump_last_app_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only bump when an authenticated end-user makes the change.
  -- Edge functions using the service role have auth.uid() = null and won't bump.
  IF auth.uid() IS NOT NULL THEN
    NEW.last_app_edit_at = now();
  END IF;
  RETURN NEW;
END;
$$;
