CREATE UNIQUE INDEX IF NOT EXISTS participant_bookings_period_reservation_code_uniq
  ON public.participant_bookings (period_id, reservation_code)
  WHERE reservation_code IS NOT NULL;