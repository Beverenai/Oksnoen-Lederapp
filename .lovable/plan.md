## Mål

En ny les-kun visning der admin kan velge hvilken som helst periode (1–7) og se all data fra den perioden — uten å bytte aktiv periode. Ingen data endres, alt kan eksporteres.

## Hvor det ligger

Ny seksjon i Innstillinger: **«Periodearkiv»**, samt egen rute `/arkiv` slik at man kan lenke direkte dit. Øverst en periodevelger (nedtrekk/chips) som viser navn, datoer og om perioden er aktiv eller arkivert.

Viktig: velgeren styrer kun hva som vises i arkivet. Den skriver ikke til `periods.is_active`, så aktiv periode og alle funksjonsbrytere (utsjekk, lag, gensere osv.) forblir urørt.

## Faner i arkivet

1. **Deltakere** – navn, alder/fødselsdato, hytte + rom, lag, ankommet, poeng, bilde-miniatyr. Søk + filtre på hytte/lag.
2. **Hytterapporter** – rapport per hytte, sist oppdatert og av hvem.
3. **Nurse** – nurse-rapporter, helsenotater og helsehendelser per deltaker.
4. **Dynga** – kolonner, kort (deltakernavn) og alle kommentarer med leder og tidspunkt.
5. **Aktiviteter & poeng** – registrerte aktiviteter per deltaker, ekstra poeng (hvem ga, hva, når), totale poeng.
6. **Lag** – de 10 lagene med navn/farge, medlemmer, bonuspoeng og totalsum, kjøkkentjeneste.
7. **Hemmelige ord** – tildelte ord, par og matcher.
8. **Booking** – booking-info inkl. foresatte, mobilnummer, adresse, e-post, betalingsstatus.
9. **Gensere** – forhåndsbestilt, hentet, kjøpt på leir.
10. **Øvrig** – hendelser (incidents), fix-oppgaver, rombytter, tauverk-kontroller, gjenglemt, kunngjøringer, historier.

Alle faner er les-kun (ingen lagre-/slette-knapper).

## Eksport

- Per fane: **Last ned CSV** for det datasettet i valgt periode.
- **Eksporter alt** – laster ned én ZIP med én CSV per datasett.
- **Print / PDF** – åpner en printvennlig rapport for valgt periode (samme mønster som nurse-rapport-eksporten som allerede finnes), som kan lagres som PDF fra nettleser/iPhone.

## Teknisk

- Ny side `src/pages/admin/PeriodArchive.tsx` + fanekomponenter under `src/components/archive/`.
- Ny hook `useArchivePeriod(periodId)`: alle spørringer filtrerer på valgt `period_id` (ikke `get_active_period_id()`), og bruker React Query med `queryKey: ['archive', periodId, dataset]`.
- Hytter, ledere og aktivitetsdefinisjoner er globale (ikke periodescopet) — de joines inn som oppslag, slik du ba om tidligere.
- Tilgang: kun admin/superadmin (nurse-faner også for nurse). Eksisterende RLS dekker lesing; ingen skjemaendringer trengs — alle relevante tabeller har allerede `period_id`.
- CSV genereres klientside; ZIP med et lite bibliotek (jszip) hvis ikke allerede tilgjengelig.
- Ny rute registreres i `App.tsx` og lenke legges inn i innstillingsgriden.

## Avgrensninger

- Rene visnings- og eksportfunksjoner; ingen redigering av historiske perioder i denne runden.
- Vaktplaner tas ikke med i første versjon (egen datamodell) — kan legges til etterpå om du vil.
