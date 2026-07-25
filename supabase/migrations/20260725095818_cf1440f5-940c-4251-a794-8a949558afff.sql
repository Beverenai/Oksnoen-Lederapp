DROP INDEX IF EXISTS public.idx_participants_unique_name;
CREATE UNIQUE INDEX idx_participants_unique_name_per_period
  ON public.participants (period_id, lower(name));