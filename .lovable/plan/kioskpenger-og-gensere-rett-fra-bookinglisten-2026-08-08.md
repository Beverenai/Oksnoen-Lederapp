# Kioskpenger og gensere rett fra bookinglisten

Målet er at bookinglisten (som CSV-en fra periode 6) skal være den ene kilden til både kiosk-beløp og genserstørrelser, slik at periode 7 er klar uten manuelt etterarbeid.

## Dagens situasjon (verifisert)

- Bookingimporten leser allerede `Kioskpenger` og `Genser` fra CSV-en og lagrer dem på bookingraden.
- Men ingenting bruker de verdiene videre: tabellen med kioskinnskudd er helt tom (0 rader for alle perioder), så alle saldoer i Gomla står på 0 kr selv om 186 av 216 bookinger i periode 6 har et kioskbeløp.
- Genserstørrelser må i dag importeres på nytt via en egen fil i Gensere-fanen; i periode 6 har 145 bookinger størrelse, mens gensertabellen er fylt fra den separate importen.

## Det som skal bygges

### 1. Synk fra booking (automatisk + knapp)
- Rett etter en bookingimport kjøres en synk som kobler bookinger til deltagere på fullt navn.
- I tillegg en knapp «Synk kioskpenger og gensere fra booking» i booking-kortet, som kan kjøres når som helst (typisk etter at deltagerlisten er importert). Kjøres den flere ganger, blir det ingen dobbeltføring.

### 2. Kioskpenger
- For hver matchet deltager opprettes ett innskudd merket som «booking» med beløpet fra bookinglisten, slik at saldoen i Gomla er riktig fra første salg.
- Endres beløpet i en senere bookingfil, justeres booking-innskuddet til det nye beløpet. Manuelle innskudd og korreksjoner gjort i Gomla blir aldri overskrevet.
- Bookinger uten beløp (eller 0) gir ingen innskudd.

### 3. Genserstørrelser
- Forhåndsbestilt størrelse settes fra `Genser`-kolonnen (xxs–l, normalisert til store bokstaver).
- Ny størrelse i en ny bookingfil oppdaterer forhåndsbestillingen, men «hentet», «hentet størrelse» og «kjøpt på leir» røres ikke.
- Tom kolonne betyr ingen forhåndsbestilling.

### 4. Resultatvisning
- Etter synk vises en oppsummering: antall innskudd opprettet/oppdatert, antall genserstørrelser satt, og en liste over bookingnavn som ikke fant en deltager, så navn kan rettes manuelt.

## Teknisk

- Ny hjelpefunksjon (f.eks. `src/lib/syncBookingExtras.ts`) som leser `participant_bookings` og `participants` for valgt periode, normaliserer navn (samme normalisering som Gensere-importen bruker), og skriver:
  - `kiosk_deposits` med `kind = 'booking'` — én rad per deltager per periode; oppdateres ved endring.
  - `participant_sweaters` upsert på `participant_id,period_id`, bare feltet `preordered_size`.
- Databaseendring: unik indeks på `kiosk_deposits (period_id, participant_id)` der `kind = 'booking'`, slik at synken blir idempotent.
- `BookingImportCard.tsx` kaller synken etter import og får en ny knapp + resultatpanel med umatchede navn.
- Saldovisningen i Gomla trenger ingen endring — den summerer allerede innskudd minus salg.

## Klargjøring for periode 7

Ingen data endres for periode 6 i denne omgang. Når periode 7 er aktiv: last opp bookingfila, importer deltagerlisten, og trykk synk — da har alle riktig kiosksaldo og genserstørrelse. Si fra hvis du også vil at periode 6 skal etterfylles med kioskinnskudd fra booking.
