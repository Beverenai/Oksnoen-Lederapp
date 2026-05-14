ALTER TABLE public.special_duties DROP CONSTRAINT special_duties_duty_type_check;
ALTER TABLE public.special_duties ADD CONSTRAINT special_duties_duty_type_check
CHECK (duty_type = ANY (ARRAY['morgenvakt','bingsvakt','nattevakt','frokostvakt','kjokkenvakt','sanitas','seilern_box','neste_frokostvakt']));