
-- Word pairs (global, seeded once)
CREATE TABLE public.secret_word_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word_1 TEXT NOT NULL UNIQUE,
  word_2 TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.secret_word_pairs TO authenticated;
GRANT ALL ON public.secret_word_pairs TO service_role;
ALTER TABLE public.secret_word_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders read pairs" ON public.secret_word_pairs FOR SELECT TO authenticated USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admin manage pairs" ON public.secret_word_pairs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Assignments (participant -> word, per period)
CREATE TABLE public.secret_word_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.secret_word_pairs(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (1,2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, participant_id),
  UNIQUE (period_id, pair_id, slot)
);
CREATE INDEX ON public.secret_word_assignments (period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secret_word_assignments TO authenticated;
GRANT ALL ON public.secret_word_assignments TO service_role;
ALTER TABLE public.secret_word_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders read assignments" ON public.secret_word_assignments FOR SELECT TO authenticated USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admin manage assignments" ON public.secret_word_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Matches (per period)
CREATE TABLE public.secret_word_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.secret_word_pairs(id) ON DELETE CASCADE,
  participant_a_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  matched_by UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, pair_id)
);
CREATE INDEX ON public.secret_word_matches (period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secret_word_matches TO authenticated;
GRANT ALL ON public.secret_word_matches TO service_role;
ALTER TABLE public.secret_word_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaders read matches" ON public.secret_word_matches FOR SELECT TO authenticated USING (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Leaders create matches" ON public.secret_word_matches FOR INSERT TO authenticated WITH CHECK (public.current_leader_id() IS NOT NULL);
CREATE POLICY "Admin manage matches" ON public.secret_word_matches FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed 72 pairs
INSERT INTO public.secret_word_pairs (word_1, word_2) VALUES
('SALT','PEPPER'),('TORDEN','LYN'),('EBBE','FLO'),('PIL','BUE'),('ROR','SEIL'),
('KROK','SNØRE'),('NORD','SØR'),('ØST','VEST'),('BÅL','GLO'),('KART','KOMPASS'),
('ANKER','KJETTING'),('MAST','STORSEIL'),('BØLGE','SKUM'),('MÅKE','SKRIK'),('KRABBE','KLO'),
('TANG','TARE'),('SKJÆR','BRENNING'),('FYR','LYKT'),('BRYGGE','FORTØYNING'),('KANO','PADLEÅRE'),
('TELT','PLUGG'),('SOVEPOSE','LIGGEUNDERLAG'),('KOMPASSNÅL','MAGNET'),('STJERNE','HIMMEL'),('MÅNE','TIDEVANN'),
('SOL','SKYGGE'),('REGN','REGNBUE'),('STORM','STILLE'),('TÅKE','LUR'),('VIND','KULING'),
('FISK','GARN'),('MAKRELL','DORG'),('TORSK','JUKSA'),('REKE','TEINE'),('SJØSTJERNE','FJÆREPYTT'),
('SKATT','KISTE'),('PIRAT','PAPEGØYE'),('KAPTEIN','STYRMANN'),('MATROS','DEKK'),('LOS','LED'),
('HAVN','MOLO'),('ØY','HOLME'),('VIK','BUKT'),('STRAND','SANDSLOTT'),('SVABERG','BADEHÅNDKLE'),
('STUP','PLASK'),('SVØMMEFØTTER','DYKKERMASKE'),('REDNINGSVEST','LIVBØYE'),('TUBE','TAU'),('VANNSKI','KJØLVANN'),
('KLATRING','KARABIN'),('RAPPELL','SELE'),('KNUTE','PÅLESTIKK'),('LEIRBÅL','PINNEBRØD'),('GRILL','KULL'),
('MARSHMALLOW','SPIDD'),('KAKAO','TERMOS'),('VAFFEL','SYLTETØY'),('BOLLE','ROSIN'),('SAFT','BEGER'),
('MYGG','KLØE'),('MAUR','TUE'),('EKORN','NØTT'),('UGLE','NATT'),('REV','HI'),
('ELG','GEVIR'),('HVAL','BLÅST'),('SEL','PELS'),('ØRN','KLIPPE'),('FALK','JAKT'),
('HUBRO','SKOG'),('FLØYTE','DOMMER');
