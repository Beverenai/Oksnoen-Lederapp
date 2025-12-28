-- Add extra_1 to extra_5 as home screen elements
INSERT INTO home_screen_config (element_key, label, is_visible, sort_order, title, icon) VALUES
  ('extra_1', 'Ekstra 1', false, 6, 'Ekstra 1', 'info'),
  ('extra_2', 'Ekstra 2', false, 7, 'Ekstra 2', 'info'),
  ('extra_3', 'Ekstra 3', false, 8, 'Ekstra 3', 'info'),
  ('extra_4', 'Ekstra 4', false, 9, 'Ekstra 4', 'info'),
  ('extra_5', 'Ekstra 5', false, 10, 'Ekstra 5', 'info')
ON CONFLICT (element_key) DO NOTHING;