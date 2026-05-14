-- v5 spec corrections to shift_types

-- 1) Nattevakt: 23:30–04:00, 4.5t (was 23:30–05:00, 5.5t)
UPDATE public.shift_types
SET end_time = '04:00:00', duration_hours = 4.5
WHERE slug = 'nattevakt' AND day_type = 'normal';

-- 2) Remove combined sanitas_box and old seilern; replace with split slugs
DELETE FROM public.shift_types WHERE day_type = 'normal' AND slug IN ('sanitas_box', 'seilern');

-- 3) sanitas: 23:30–01:00, 1.5t, 2 from Økt 1-team (18+)
INSERT INTO public.shift_types
  (slug, day_type, name, start_time, end_time, duration_hours, sort_order, min_leaders, requires_18_plus, all_must_attend)
VALUES
  ('sanitas',     'normal', 'Sanitas',      '23:30:00', '01:00:00', 1.50, 17, 2, true,  false),
  ('seilern_box', 'normal', 'Seilern + Box','09:15:00', '10:00:00', 0.75, 18, 2, false, false)
ON CONFLICT (slug, day_type) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  duration_hours = EXCLUDED.duration_hours,
  sort_order = EXCLUDED.sort_order,
  min_leaders = EXCLUDED.min_leaders,
  requires_18_plus = EXCLUDED.requires_18_plus;
