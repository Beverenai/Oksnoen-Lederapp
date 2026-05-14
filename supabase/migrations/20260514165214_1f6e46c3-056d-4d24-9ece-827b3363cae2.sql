DELETE FROM public.shift_assignments
WHERE shift_type_id IN (
  SELECT id FROM public.shift_types
  WHERE day_type = 'normal' AND slug IN ('sanitas_box', 'seilern')
);

DELETE FROM public.shift_types WHERE day_type = 'normal' AND slug IN ('sanitas_box', 'seilern');

INSERT INTO public.shift_types
  (slug, day_type, name, start_time, end_time, duration_hours, sort_order, min_leaders, requires_18_plus, all_must_attend)
VALUES
  ('sanitas',     'normal', 'Sanitas',       '23:30:00', '01:00:00', 1.50, 17, 2, true,  false),
  ('seilern_box', 'normal', 'Seilern + Box', '09:15:00', '10:00:00', 0.75, 18, 2, false, false)
ON CONFLICT (slug, day_type) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  duration_hours = EXCLUDED.duration_hours,
  sort_order = EXCLUDED.sort_order,
  min_leaders = EXCLUDED.min_leaders,
  requires_18_plus = EXCLUDED.requires_18_plus;