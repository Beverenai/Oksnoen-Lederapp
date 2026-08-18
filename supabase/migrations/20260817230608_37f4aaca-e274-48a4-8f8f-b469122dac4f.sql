UPDATE public.leirskole_week_plan_cells c
SET content = NULLIF(
  (
    SELECT string_agg(line, E'\n' ORDER BY ord)
    FROM unnest(string_to_array(c.content, E'\n')) WITH ORDINALITY AS t(line, ord)
    WHERE lower(line) NOT LIKE '%sanitas%'
      AND lower(line) NOT LIKE '%hyttevask%'
      AND lower(line) NOT LIKE '%gomla%'
  ), ''),
    updated_at = now()
WHERE c.row_index IN (1,2,3)
  AND (lower(c.content) LIKE '%sanitas%' OR lower(c.content) LIKE '%hyttevask%' OR lower(c.content) LIKE '%gomla%');

DELETE FROM public.leirskole_activity_assignments
WHERE auto_generated = true
  AND activity IN ('sanitas','hyttevask','gomla')
  AND session IN ('formiddag','ettermiddag','kveld');