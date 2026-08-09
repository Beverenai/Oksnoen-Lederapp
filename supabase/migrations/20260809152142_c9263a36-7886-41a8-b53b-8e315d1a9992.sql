CREATE OR REPLACE FUNCTION public.get_kitchen_allergy_notes()
RETURNS TABLE(
  participant_id uuid,
  name text,
  cabin_name text,
  room text,
  booking_notes text,
  health_info text,
  participant_notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.name,
         c.name,
         p.room,
         b.notes_info,
         hi.info,
         p.notes
    FROM public.participants p
    LEFT JOIN public.cabins c ON c.id = p.cabin_id
    LEFT JOIN public.participant_bookings b
           ON b.participant_id = p.id AND b.period_id = p.period_id
    LEFT JOIN public.participant_health_info hi
           ON hi.participant_id = p.id AND hi.period_id = p.period_id
   WHERE p.period_id = public.get_active_period_id()
     AND (public.is_kitchen() OR public.is_admin() OR public.is_nurse())
   ORDER BY p.name
$$;

REVOKE EXECUTE ON FUNCTION public.get_kitchen_allergy_notes() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_allergy_notes() TO authenticated;