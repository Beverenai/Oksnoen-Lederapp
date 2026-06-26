
-- Archive table for nurse data preserved per Nurse-period
CREATE TABLE public.nurse_period_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.nurse_periods(id) ON DELETE CASCADE,
  participant_id uuid,
  participant_name text NOT NULL,
  participant_age integer,
  participant_cabin text,
  participant_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_info text,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_period_archives TO authenticated;
GRANT ALL ON public.nurse_period_archives TO service_role;

ALTER TABLE public.nurse_period_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and nurses can view archives"
  ON public.nurse_period_archives FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_nurse());

CREATE POLICY "Admins can manage archives"
  ON public.nurse_period_archives FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_nurse_period_archives_period ON public.nurse_period_archives(period_id);

-- RPC: start a new period
-- 1. Snapshots all nurse data (notes/events/info) per participant into nurse_period_archives for given period
-- 2. Attaches gjenglemt items with NULL period_id to the active gjenglemt period
-- 3. Deletes all overnatting_responses
-- 4. Deletes all participants (cascade removes activities/notes/events/info)
CREATE OR REPLACE FUNCTION public.start_new_period(_nurse_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived int := 0;
  v_deleted_participants int := 0;
  v_deleted_overnatting int := 0;
  v_gjenglemt_attached int := 0;
  v_active_gjenglemt uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can start a new period';
  END IF;

  IF _nurse_period_id IS NULL THEN
    RAISE EXCEPTION 'Nurse period id is required';
  END IF;

  -- 1. Snapshot nurse data per participant who has any health entry
  WITH affected AS (
    SELECT p.id, p.name, p.age, p.cabin, to_jsonb(p) AS snap
    FROM public.participants p
    WHERE EXISTS (SELECT 1 FROM public.participant_health_notes n WHERE n.participant_id = p.id)
       OR EXISTS (SELECT 1 FROM public.participant_health_events e WHERE e.participant_id = p.id)
       OR EXISTS (SELECT 1 FROM public.participant_health_info i WHERE i.participant_id = p.id)
  ),
  inserted AS (
    INSERT INTO public.nurse_period_archives
      (period_id, participant_id, participant_name, participant_age, participant_cabin,
       participant_snapshot, health_info, notes, events)
    SELECT
      _nurse_period_id,
      a.id,
      a.name,
      a.age,
      a.cabin,
      a.snap,
      (SELECT string_agg(info, E'\n---\n') FROM public.participant_health_info WHERE participant_id = a.id),
      COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at)
                FROM public.participant_health_notes n WHERE n.participant_id = a.id), '[]'::jsonb),
      COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at)
                FROM public.participant_health_events e WHERE e.participant_id = a.id), '[]'::jsonb)
    FROM affected a
    RETURNING 1
  )
  SELECT count(*) INTO v_archived FROM inserted;

  -- 2. Attach orphan gjenglemt items to active gjenglemt period
  SELECT id INTO v_active_gjenglemt
  FROM public.gjenglemt_periods
  WHERE is_public = true
  ORDER BY start_date DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_active_gjenglemt IS NOT NULL THEN
    UPDATE public.gjenglemt_items
    SET period_id = v_active_gjenglemt, updated_at = now()
    WHERE period_id IS NULL;
    GET DIAGNOSTICS v_gjenglemt_attached = ROW_COUNT;
  END IF;

  -- 3. Delete all overnatting responses
  DELETE FROM public.overnatting_responses;
  GET DIAGNOSTICS v_deleted_overnatting = ROW_COUNT;

  -- 4. Delete all participants (cascade removes related health/activity rows)
  DELETE FROM public.participants;
  GET DIAGNOSTICS v_deleted_participants = ROW_COUNT;

  RETURN jsonb_build_object(
    'archived_participants', v_archived,
    'deleted_participants', v_deleted_participants,
    'deleted_overnatting', v_deleted_overnatting,
    'gjenglemt_attached_to_active_period', v_gjenglemt_attached,
    'active_gjenglemt_period_id', v_active_gjenglemt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_new_period(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.start_new_period(uuid) TO authenticated;
