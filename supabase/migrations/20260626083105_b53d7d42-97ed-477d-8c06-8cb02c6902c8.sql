
-- ============================================================
-- 1. Drop the deletion infrastructure (we no longer delete on new period)
-- ============================================================
DROP FUNCTION IF EXISTS public.start_new_period(uuid);
DROP TABLE IF EXISTS public.nurse_period_archives CASCADE;

-- ============================================================
-- 2. Rename gjenglemt_periods -> periods (gjenglemt_items.period_id FK follows)
-- ============================================================
ALTER TABLE public.gjenglemt_periods RENAME TO periods;

-- Add is_active flag (only one true at a time, enforced via partial unique index)
ALTER TABLE public.periods ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS periods_only_one_active
  ON public.periods ((is_active)) WHERE is_active = true;

-- ============================================================
-- 3. Migrate existing nurse_periods into periods (preserve ids)
-- ============================================================
INSERT INTO public.periods (id, name, slug, start_date, end_date, is_public, is_active, created_at, updated_at)
SELECT
  np.id,
  np.name,
  -- generate slug, avoid collision with existing periods slugs
  lower(regexp_replace(np.name || '-' || substr(np.id::text, 1, 6), '[^a-z0-9]+', '-', 'g')),
  np.start_date,
  np.end_date,
  false,
  false,  -- never auto-activate from migrated nurse periods (we'll seed one below)
  np.created_at,
  np.updated_at
FROM public.nurse_periods np
ON CONFLICT (id) DO NOTHING;

-- Now drop old nurse_periods table
DROP TABLE IF EXISTS public.nurse_periods CASCADE;

-- ============================================================
-- 4. Add period_id to data tables
-- ============================================================
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
ALTER TABLE public.participant_health_notes
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
ALTER TABLE public.participant_health_events
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
ALTER TABLE public.participant_health_info
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participants_period ON public.participants(period_id);
CREATE INDEX IF NOT EXISTS idx_health_notes_period ON public.participant_health_notes(period_id);
CREATE INDEX IF NOT EXISTS idx_health_events_period ON public.participant_health_events(period_id);
CREATE INDEX IF NOT EXISTS idx_health_info_period ON public.participant_health_info(period_id);

-- ============================================================
-- 5. Seed "Periode 1 2026" if no active period exists
-- ============================================================
DO $$
DECLARE
  v_active uuid;
BEGIN
  SELECT id INTO v_active FROM public.periods WHERE is_active = true LIMIT 1;

  IF v_active IS NULL THEN
    -- try to find an existing "Periode 1 2026" (or similar) first
    SELECT id INTO v_active FROM public.periods
    WHERE lower(name) LIKE '%periode 1%2026%' OR lower(slug) LIKE '%periode-1%2026%'
    ORDER BY created_at LIMIT 1;

    IF v_active IS NULL THEN
      INSERT INTO public.periods (name, slug, is_public, is_active, start_date)
      VALUES ('Periode 1 2026', 'periode-1-2026', true, true, CURRENT_DATE)
      RETURNING id INTO v_active;
    ELSE
      UPDATE public.periods SET is_active = true WHERE id = v_active;
    END IF;
  END IF;

  -- Backfill all NULL period_id rows to active period
  UPDATE public.participants SET period_id = v_active WHERE period_id IS NULL;
  UPDATE public.participant_health_notes SET period_id = v_active WHERE period_id IS NULL;
  UPDATE public.participant_health_events SET period_id = v_active WHERE period_id IS NULL;
  UPDATE public.participant_health_info SET period_id = v_active WHERE period_id IS NULL;
  UPDATE public.gjenglemt_items SET period_id = v_active WHERE period_id IS NULL;
END $$;

-- ============================================================
-- 6. Helper: current active period
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_period_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.periods WHERE is_active = true LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_active_period_id() TO authenticated;

-- ============================================================
-- 7. Trigger: auto-set period_id to active when null on insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_period_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.period_id IS NULL THEN
    NEW.period_id := public.get_active_period_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_period_on_participants ON public.participants;
CREATE TRIGGER set_period_on_participants
  BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

DROP TRIGGER IF EXISTS set_period_on_health_notes ON public.participant_health_notes;
CREATE TRIGGER set_period_on_health_notes
  BEFORE INSERT ON public.participant_health_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

DROP TRIGGER IF EXISTS set_period_on_health_events ON public.participant_health_events;
CREATE TRIGGER set_period_on_health_events
  BEFORE INSERT ON public.participant_health_events
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

DROP TRIGGER IF EXISTS set_period_on_health_info ON public.participant_health_info;
CREATE TRIGGER set_period_on_health_info
  BEFORE INSERT ON public.participant_health_info
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

DROP TRIGGER IF EXISTS set_period_on_gjenglemt ON public.gjenglemt_items;
CREATE TRIGGER set_period_on_gjenglemt
  BEFORE INSERT ON public.gjenglemt_items
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
