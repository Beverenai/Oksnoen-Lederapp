# Sesongvisning: se alle perioder samlet

Admin får en bryter «Hele sesongen» som slår av periode-filteret i appen for **sin egen** økt. Da vises deltagere, statistikk, Gomla og nurse-data fra alle perioder samtidig, i **kun lesing**-modus.

## Slik oppleves det

- I Admin → Innstillinger kommer et kort «Hele sesongen (arkivmodus)» med en bryter.
- Når den er på: en tydelig topp-stripe «Arkivmodus – alle perioder, kun lesing» vises over hele appen, så ingen tror de jobber i en aktiv periode.
- Passkontroll: alle deltagere fra alle perioder i samme liste, hver med et periodemerke (f.eks. «P6»), og filter for periode i tillegg til dagens filtre. Ingen registrering av aktiviteter, poeng eller pass mens modus er på.
- Deltagerstats: aktiviteter, styrkeprøver, lag, hendelser og ambassadører regnes på tvers av alle perioder, med periodekolonne i eksportene.
- Gomla: salg, saldo og rapporter for alle perioder, med periodemerke per salg. Nytt salg, innskudd, annullering og redigering er deaktivert.
- Nurse: rapporter, notater og hendelser fra alle perioder, sortert på dato med periodemerke. Redigering låst.
- Bryteren gjelder bare den innloggede adminen (lagret lokalt på enheten), og påvirker ikke ledere.

## Teknisk

**Tilgang**
- I dag er `participants` begrenset av en lese-regel til aktiv periode (`period_id = get_active_period_id() OR period_id IS NULL`). Regelen utvides med `OR is_admin()` slik at admin kan lese alle perioder. Ingen andre roller endres.
- Før implementering: gå gjennom lese-reglene for kiosk-, nurse- og hendelsestabellene og bekreft hvilke som er periodebegrenset i database vs. bare i frontend-koden; kun de som faktisk er begrenset trenger regelendring.

**Frontend**
- Ny `SeasonViewContext` (`src/contexts/`) med `seasonView: boolean` + `readOnly`, persistert i `localStorage`, kun tilgjengelig for admin/superadmin (`is_admin`).
- `useActivePeriodId` får en variant/wrapper som returnerer `null` når `seasonView` er på; alle `.eq('period_id', ...)`-kall bytter til «hopp over filter hvis null». Query keys inkluderer `seasonView` så cache ikke blandes.
- Perioder hentes én gang (`periods`-tabellen) for å vise navn i periodemerker og periodefilter.
- Ny `PeriodBadge`-komponent brukes i Passkontroll, Gomla-historikk og nurse-lister.
- Skrivehandlinger (aktivitetsregistrering, bonuspoeng, pass, kiosk-salg/innskudd/annuller, nurse-notater, hendelser) skjules eller disables når `readOnly` er på — samme mønster som eksisterende feature-toggles.
- Topp-stripe legges i `AppLayout` og respekterer safe-area, i tråd med dagens layout.

**Berørte filer (hovedsakelig)**
- `src/contexts/SeasonViewContext.tsx` (ny), `src/components/layout/AppLayout.tsx`
- `src/pages/Passport.tsx`, `src/components/passport/*`
- `src/pages/admin/ParticipantStats.tsx`, `src/components/stats/*`
- `src/pages/Kiosk.tsx`, `src/hooks/useKiosk.ts`, `src/components/stats/KioskTab.tsx`
- `src/pages/Nurse.tsx`, `src/components/nurse/*`
- `src/components/admin/settings/` (nytt bryter-kort)

**Utenfor omfang**
- Periodearkiv (`/arkiv`) beholdes som i dag.
- Ingen endring for ledere/nurse-rollen, ingen designendringer utover periodemerker og arkiv-stripen.
