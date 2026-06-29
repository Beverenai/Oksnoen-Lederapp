
CREATE TABLE public.participant_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID REFERENCES public.periods(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  reservation_code TEXT,
  reservation_number TEXT,
  status TEXT,
  period_label TEXT,
  first_name TEXT,
  last_name TEXT,
  birth_date DATE,
  gender TEXT,
  times_attended INTEGER,
  sweater_size TEXT,
  kiosk_money NUMERIC,
  friends TEXT,
  notes_info TEXT,
  guardian_first_name TEXT,
  guardian_last_name TEXT,
  guardian_email TEXT,
  guardian_phone TEXT,
  address TEXT,
  postal_code TEXT,
  postal_city TEXT,
  price NUMERIC,
  discount NUMERIC,
  prepayment NUMERIC,
  payment_status TEXT,
  payment_reference TEXT,
  invoiced_date DATE,
  paid_date DATE,
  cancelled_date DATE,
  booking_time TIMESTAMPTZ,
  seat_confirmed DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX participant_bookings_period_reservation_uniq
  ON public.participant_bookings (period_id, reservation_code)
  WHERE reservation_code IS NOT NULL;

CREATE INDEX participant_bookings_period_idx ON public.participant_bookings(period_id);
CREATE INDEX participant_bookings_participant_idx ON public.participant_bookings(participant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_bookings TO authenticated;
GRANT ALL ON public.participant_bookings TO service_role;

ALTER TABLE public.participant_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bookings"
  ON public.participant_bookings FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert bookings"
  ON public.participant_bookings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update bookings"
  ON public.participant_bookings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete bookings"
  ON public.participant_bookings FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER participant_bookings_set_period
  BEFORE INSERT ON public.participant_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE TRIGGER participant_bookings_updated_at
  BEFORE UPDATE ON public.participant_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
