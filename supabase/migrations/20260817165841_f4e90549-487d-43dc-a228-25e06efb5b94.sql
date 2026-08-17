UPDATE public.leirskole_posts
SET start_time = '22:30', end_time = '01:30'
WHERE (post_type = 'night' OR is_night = true)
  AND start_time = '23:00' AND end_time = '07:00';

UPDATE public.leirskole_weeks SET max_daily_hours = 8 WHERE max_daily_hours IS NULL OR max_daily_hours > 8;
UPDATE public.leirskole_staff SET max_daily_hours = 8 WHERE max_daily_hours IS NULL OR max_daily_hours > 8;