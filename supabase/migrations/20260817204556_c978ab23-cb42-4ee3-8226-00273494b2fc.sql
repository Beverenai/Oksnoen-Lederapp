DELETE FROM public.leirskole_week_plan_cells WHERE content ILIKE '%ankom%';
UPDATE public.leirskole_activity_types SET is_active = false WHERE key = 'ankomt';
UPDATE public.leirskole_session_activities SET activity_keys = array_remove(activity_keys, 'ankomt');