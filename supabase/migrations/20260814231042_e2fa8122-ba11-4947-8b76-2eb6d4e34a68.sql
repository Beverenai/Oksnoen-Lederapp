ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leaders_deleted_at_idx ON public.leaders (deleted_at);

CREATE OR REPLACE FUNCTION public.soft_delete_leader(_leader_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := public.current_leader_id();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;
  IF _leader_id = _me THEN
    RAISE EXCEPTION 'Du kan ikke slette deg selv';
  END IF;
  IF public.has_role(_leader_id, 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Kan ikke slette superadmin';
  END IF;

  UPDATE public.leaders
     SET deleted_at = now(),
         deleted_by = _me,
         is_active = false
   WHERE id = _leader_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_leader(_leader_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Ikke tilgang';
  END IF;

  UPDATE public.leaders
     SET deleted_at = NULL,
         deleted_by = NULL
   WHERE id = _leader_id;
END;
$$;