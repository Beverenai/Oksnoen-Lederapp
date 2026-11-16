-- Fast person-ID på deltakere og bookinger.
--
-- `participants` har én rad per deltaker per periode (deltakelsen). `person_id`
-- er barnets faste ID på tvers av perioder og år. Samme ID brukes i huben
-- (booking og admin), som eier selve personen og foresatte. Lederappen lagrer
-- bare referansen.
--
-- Kan kjøres flere ganger: rader som allerede har person_id røres ikke, og nye
-- rader med samme navn og fødselsdato som en kjent person får samme ID.

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS person_id uuid;
ALTER TABLE public.participant_bookings ADD COLUMN IF NOT EXISTS person_id uuid;

COMMENT ON COLUMN public.participants.person_id IS
  'Barnets faste ID på tvers av perioder og år. Samme ID som i huben.';
COMMENT ON COLUMN public.participant_bookings.person_id IS
  'Barnets faste ID. Samme som participants.person_id og personen i huben.';

-- 1. Deltakere. Samme navn og fødselsdato regnes som samme barn.
--    Rader uten fødselsdato får hver sin ID og må sjekkes for hånd.
WITH keyed AS (
  SELECT id,
         CASE WHEN birth_date IS NOT NULL
              THEN lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) || '|' || birth_date::text
         END AS k
  FROM public.participants
  WHERE person_id IS NULL
),
known AS (
  SELECT DISTINCT ON (k) k, person_id
  FROM (
    SELECT lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) || '|' || birth_date::text AS k, person_id
    FROM public.participants
    WHERE person_id IS NOT NULL AND birth_date IS NOT NULL
  ) e
  ORDER BY k
),
fresh AS (
  SELECT d.k, gen_random_uuid() AS person_id
  FROM (SELECT DISTINCT k FROM keyed WHERE k IS NOT NULL) d
  WHERE NOT EXISTS (SELECT 1 FROM known WHERE known.k = d.k)
),
resolved AS (
  SELECT keyed.id, COALESCE(known.person_id, fresh.person_id) AS person_id
  FROM keyed
  LEFT JOIN known ON known.k = keyed.k
  LEFT JOIN fresh ON fresh.k = keyed.k
)
UPDATE public.participants p
SET person_id = COALESCE(resolved.person_id, gen_random_uuid())
FROM resolved
WHERE p.id = resolved.id;

-- 2. Bookinger som er koblet til en deltaker.
UPDATE public.participant_bookings b
SET person_id = p.person_id
FROM public.participants p
WHERE b.person_id IS NULL
  AND b.participant_id = p.id
  AND p.person_id IS NOT NULL;

-- 3. Bookinger uten kobling: samme periode, navn og fødselsdato som en deltaker.
--    Setter bare person_id. participant_id røres ikke.
UPDATE public.participant_bookings b
SET person_id = p.person_id
FROM public.participants p
WHERE b.person_id IS NULL
  AND b.birth_date IS NOT NULL
  AND p.period_id = b.period_id
  AND p.birth_date = b.birth_date
  AND lower(btrim(regexp_replace(p.name, '\s+', ' ', 'g')))
      = lower(btrim(regexp_replace(coalesce(b.first_name, '') || ' ' || coalesce(b.last_name, ''), '\s+', ' ', 'g')));

-- Én deltakelse per person per periode.
CREATE UNIQUE INDEX IF NOT EXISTS participants_person_period_uniq
  ON public.participants (person_id, period_id)
  WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participants_person_idx
  ON public.participants (person_id);
CREATE INDEX IF NOT EXISTS participant_bookings_person_idx
  ON public.participant_bookings (person_id);
