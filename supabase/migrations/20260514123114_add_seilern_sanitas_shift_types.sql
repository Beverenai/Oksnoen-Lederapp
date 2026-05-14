-- Add Seilern and Sanitas+Box shift_types for normal days
INSERT INTO public.shift_types (slug, day_type, name, start_time, end_time, duration_hours, sort_order, min_leaders, requires_18_plus, all_must_attend)
VALUES
  ('seilern',     'normal', 'Seilern',       '09:15:00', '10:00:00', 0.75, 17, 2, false, false),
  ('sanitas_box', 'normal', 'Sanitas + Box', '23:30:00', '05:00:00', 5.50, 18, 2, true,  false)
ON CONFLICT DO NOTHING;
