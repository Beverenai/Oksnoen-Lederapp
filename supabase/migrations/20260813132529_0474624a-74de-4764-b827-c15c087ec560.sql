ALTER TABLE public.periods
  ADD COLUMN IF NOT EXISTS season_year integer;

UPDATE public.periods
SET season_year = COALESCE(EXTRACT(YEAR FROM start_date)::int, 2026)
WHERE season_year IS NULL;

ALTER TABLE public.periods
  ALTER COLUMN season_year SET NOT NULL,
  ALTER COLUMN season_year SET DEFAULT EXTRACT(YEAR FROM now())::int;

CREATE INDEX IF NOT EXISTS periods_season_year_idx ON public.periods (season_year);

CREATE OR REPLACE FUNCTION public.set_period_season_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.season_year IS NULL THEN
    NEW.season_year := COALESCE(EXTRACT(YEAR FROM NEW.start_date)::int, EXTRACT(YEAR FROM now())::int);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_period_season_year_trg ON public.periods;
CREATE TRIGGER set_period_season_year_trg
  BEFORE INSERT ON public.periods
  FOR EACH ROW EXECUTE FUNCTION public.set_period_season_year();