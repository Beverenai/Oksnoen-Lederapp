CREATE UNIQUE INDEX IF NOT EXISTS kiosk_deposits_booking_unique
  ON public.kiosk_deposits (period_id, participant_id)
  WHERE kind = 'booking';