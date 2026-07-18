## Mål
Admin skal kunne åpne booking-info (telefon, e-post, foresatte, osv.) direkte fra en deltager i deltakerlisten.

## Endring
`src/components/passport/ParticipantDetailDialog.tsx`:
- Bruk eksisterende `useIsAdmin`-sjekk (samme mønster som andre admin-knapper i dialogen).
- Legg til en «Booking info»-knapp (kun synlig for admin) nær toppen av deltaker-detaljene.
- Ved klikk: slå opp `participant_bookings`-rad for aktiv periode via `first_name + last_name + birth_date` (samme nøkkel som `BookingsTab`). Ingen match ⇒ toast «Ingen booking funnet».
- Match ⇒ åpne eksisterende `BookingDetailSheet` med `booking` + `participant` prop. Sheet-en har allerede all UI (kontakt, foresatt, adresse, kommentar).

Ingen DB- eller RLS-endringer — `participant_bookings` har allerede admin-lese-policy.

## Teknisk
- Query: `supabase.from('participant_bookings').select('*').eq('period_id', activePeriodId).ilike('first_name', ...).ilike('last_name', ...).eq('birth_date', ...).maybeSingle()`, lazy (kun ved knappetrykk).
- Behold `BookingDetailSheet` uendret.