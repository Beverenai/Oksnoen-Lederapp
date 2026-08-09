CREATE TABLE public.booking_edit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL,
  period_id uuid,
  participant_name text,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  changed_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_edit_log_booking ON public.booking_edit_log(booking_id, created_at DESC);
CREATE INDEX idx_booking_edit_log_period ON public.booking_edit_log(period_id, created_at DESC);

GRANT SELECT ON public.booking_edit_log TO authenticated;
GRANT ALL ON public.booking_edit_log TO service_role;

ALTER TABLE public.booking_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view booking edit log"
ON public.booking_edit_log FOR SELECT TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_booking_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _me_name text;
  _pname text;
  _old jsonb := to_jsonb(OLD);
  _new jsonb := to_jsonb(NEW);
  _k text;
BEGIN
  IF _me IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _me_name FROM public.leaders WHERE id = _me;
  _pname := trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));

  FOR _k IN SELECT jsonb_object_keys(_new) LOOP
    IF _k IN ('updated_at','created_at','id') THEN
      CONTINUE;
    END IF;
    IF coalesce(_old ->> _k, '') IS DISTINCT FROM coalesce(_new ->> _k, '') THEN
      INSERT INTO public.booking_edit_log
        (booking_id, period_id, participant_name, field_name, old_value, new_value, changed_by, changed_by_name)
      VALUES
        (NEW.id, NEW.period_id, _pname, _k, _old ->> _k, _new ->> _k, _me, _me_name);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_booking_edits
AFTER UPDATE ON public.participant_bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_edits();