UPDATE public.leirskole_week_plan_cells
SET content = COALESCE(
  (SELECT string_agg(line, E'\n' ORDER BY ord)
   FROM unnest(string_to_array(content, E'\n')) WITH ORDINALITY AS t(line, ord)
   WHERE line !~* 'avreise'), '')
WHERE content ~* 'avreise';