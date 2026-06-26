
-- 1. Add period_id column
ALTER TABLE public.dynga_columns
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE;

-- 2. Backfill all existing columns to the active period (Periode 2)
UPDATE public.dynga_columns
SET period_id = public.get_active_period_id()
WHERE period_id IS NULL;

-- 3. For every other period that already has cards, duplicate the active-period
--    columns and re-point that period's cards to the new copies.
DO $$
DECLARE
  active_pid uuid := public.get_active_period_id();
  other_pid uuid;
  old_col record;
  new_col_id uuid;
BEGIN
  FOR other_pid IN
    SELECT DISTINCT period_id
    FROM public.dynga_cards
    WHERE period_id IS NOT NULL AND period_id <> active_pid
  LOOP
    FOR old_col IN
      SELECT id, title, color, sort_order
      FROM public.dynga_columns
      WHERE period_id = active_pid
    LOOP
      INSERT INTO public.dynga_columns (title, color, sort_order, period_id)
      VALUES (old_col.title, old_col.color, old_col.sort_order, other_pid)
      RETURNING id INTO new_col_id;

      UPDATE public.dynga_cards
      SET column_id = new_col_id
      WHERE period_id = other_pid
        AND column_id = old_col.id;
    END LOOP;
  END LOOP;
END $$;

-- 4. Auto-tag new columns with the active period via the shared trigger
DROP TRIGGER IF EXISTS set_period_id_default_dynga_columns ON public.dynga_columns;
CREATE TRIGGER set_period_id_default_dynga_columns
BEFORE INSERT ON public.dynga_columns
FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- 5. Helpful index for filtering
CREATE INDEX IF NOT EXISTS dynga_columns_period_idx ON public.dynga_columns(period_id);
