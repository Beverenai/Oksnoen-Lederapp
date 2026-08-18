DELETE FROM public.leirskole_kitchen_days k
USING public.leirskole_kitchen_days k2
WHERE k.week_id = k2.week_id AND k.date = k2.date AND k.created_at > k2.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS leirskole_kitchen_days_one_per_day
ON public.leirskole_kitchen_days (week_id, date);