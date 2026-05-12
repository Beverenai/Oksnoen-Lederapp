## Idé
Bytt ut (eller supplementer) n8n-sheet-syncen med en **lim-inn-boks** i Admin-panelet. Du kopierer hele tabellen fra Excel/Google Sheets, limer inn, og appen oppdaterer `leader_content` direkte — ingen webhook, ingen 500-feil, ingen ventetid.

## Hvordan det fungerer

### UI
Ny knapp i Admin-toppen ved siden av "Synk med Sheet": **"Lim inn fra Sheet"**.
- Åpner et Sheet/Dialog med en stor `<textarea>`.
- Liten hjelpetekst: *"Kopier rader fra Google Sheets/Excel inkl. headerrad. Kolonner: Navn, Aktivitet, Notater, Til deg, OBS!"*
- Knapper: **Forhåndsvis** → **Bekreft og lagre**.

### Parsing (frontend, ingen edge function nødvendig)
1. Splitt input på linjeskift.
2. Første rad = header. Detekter kolonnenavn (case-insensitivt, norske varianter: `navn`, `aktivitet`, `notater`, `til deg`/`personal_message`, `obs`/`obs!`).
3. Splitt hver rad på TAB (Excel/Sheets bruker tab ved kopi).
4. For hver rad: matche `Navn` mot eksisterende ledere via fornavn + etternavn (case-insensitivt, trim, fuzzy hvis nødvendig).
5. Bygg en liste `{ leader_id, current_activity, personal_notes, personal_message, obs_message }`.

### Forhåndsvisning
Før lagring vises:
- ✅ Antall rader som matchet en leder
- ⚠️ Rader som ikke ble matchet (vis navnene + årsak)
- ✏️ Endringer som faktisk skjer (diff mot nåværende verdi i DB)

Brukeren kan klikke **Bekreft** eller **Avbryt**.

### Lagring
Frontend kjører `upsert` på `leader_content` per matchet leder med de nye verdiene. Bruker vanlig Supabase-klient — RLS tillater allerede admin å skrive.

Fordi dette er en bevisst handling fra admin, vil verdiene **overskrive** dirty-flagget (samme prinsipp som "manuell sync = du vet hva du gjør"). Vi setter `last_app_edit_at = now()` (skjer automatisk via trigger) og `last_synced_at = now()` for å holde dirty-state ren.

### Multi-linje-celler
Når Excel-celler inneholder linjeskift, kopieres de som `"tekst med\nlinjeskift"` (omgitt av sitattegn). Parser må håndtere TSV med sitattegn — bruker enkel state-machine eller `papaparse` (allerede ofte i bundle, hvis ikke kan vi skrive 30 linjer).

## Hva dette IKKE løser
- **Toveis sync:** Dette er kun Sheet → App. Hvis du redigerer i appen og vil tilbake til sheet, må du fortsatt bruke "Synk"-knappen (eller la sheet være read-only/snapshot).
- **Ledermetadata** (telefon, hytte, team, etc.) håndteres ikke her — de redigeres i lederprofilen. Hvis du også vil lime inn de feltene, kan vi utvide kolonnemappingen senere.

## Anbefaling
Behold n8n-knappen i tilfelle den trengs senere, men gjør lim-inn-knappen til den primære. Da er du ikke avhengig av webhook-stabilitet for daglig drift.

## Filer som lages/endres
- Ny: `src/components/admin/PasteLeaderContentSheet.tsx` (UI + parser + lagring)
- Endret: `src/pages/admin/Admin.tsx` (legg til knappen i toppen)

Ingen DB-migrasjoner. Ingen edge functions. Ingen n8n-avhengighet.

## Spørsmål før jeg bygger
1. **Kolonner**: Er `Navn | Aktivitet | Notater | Til deg | OBS!` riktig og komplett, eller skal også `Ekstra 1–5` (de fleksible feltene) være med?
2. **Matching**: Hvis et navn i innliminga ikke finnes som leder — bare hoppe over og rapportere, eller skal det opprettes en ny leder? (Anbefaler: hoppe over.)
3. **Tomme celler**: Skal en tom celle i innliminga **slette** eksisterende verdi i appen, eller bare **ignoreres**? (Anbefaler: ignorere, så du kan oppdatere kun én kolonne uten å nullstille resten.)