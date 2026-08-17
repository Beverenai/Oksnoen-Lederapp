UPDATE public.leirskole_posts SET start_time='09:00', end_time='10:00', sort_order=1 WHERE name='Frokost';
UPDATE public.leirskole_posts SET start_time='11:00', end_time='14:00', sort_order=2 WHERE name='Økt 1';
UPDATE public.leirskole_posts SET start_time='14:00', end_time='15:00', sort_order=3 WHERE name='Middag';
UPDATE public.leirskole_posts SET start_time='16:00', end_time='19:00', sort_order=4 WHERE name='Økt 2';
UPDATE public.leirskole_posts SET start_time='19:00', end_time='20:00', sort_order=6 WHERE name='Kvelds';
UPDATE public.leirskole_posts SET start_time='20:00', end_time='21:30', sort_order=5 WHERE name='Økt 3';
UPDATE public.leirskole_posts SET sort_order=8 WHERE name='Nattevakt';

INSERT INTO public.leirskole_posts (week_id, date, name, post_type, start_time, end_time, required_leaders, is_main_shift, is_night, sort_order)
SELECT DISTINCT p.week_id, p.date, 'Sanitas', 'other', '22:30'::time, '23:00'::time, 2, false, false, 7
FROM public.leirskole_posts p
WHERE NOT EXISTS (
  SELECT 1 FROM public.leirskole_posts s WHERE s.week_id = p.week_id AND s.date = p.date AND s.name = 'Sanitas'
);