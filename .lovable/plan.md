## Arkivér Periode 3 og bytt til Periode 4

Data er allerede trygt lagret per periode via `period_id` på alle tabeller (deltakere, aktiviteter, nurse-rapport, helsehendelser/-notater, gjenglemt, hytterapporter, rombytter, taukontroll, dynga, fix, roulette osv.). Bytte av aktiv periode sletter ingenting — Periode 3 forblir intakt og kan alltid åpnes igjen via periodevelgeren.

### Steg

1. **Backup først (anbefalt, gjør du selv i UI)**
   - Nurse → Rapport → last ned HTML/PDF for Periode 3
   - Admin → Deltakere → eksporter CSV for Periode 3
   - Admin → Gjenglemt / `/gjenglemt-admin` er allerede tverr-periode og trenger ingen eksport

2. **Bytt aktiv periode til Periode 4**
   - Migrering som setter `is_active = false` på alle perioder og `is_active = true` på Periode 4
   - Realtime-abonnementer på `periods` sørger for at appen (nurse-rapport, gjenglemt, home, passkontroll) plukker opp den nye aktive perioden umiddelbart uten reload

3. **Verifisering etter bytte**
   - Bekreft antall rader per periode (deltakere, aktiviteter, gjenglemt, nurse) via read-query, slik at Periode 3 er urørt og Periode 4 starter tom
   - Rapporter tallene tilbake i chatten

### Ingen kodeendringer
Alt scoping-arbeid (triggere som stempler `period_id`, hooks som leser aktiv periode) er allerede på plass fra tidligere økter — dette er kun en dataoperasjon.

### Bekreft før jeg kjører
Vil du at jeg bytter til Periode 4 nå, eller vil du først laste ned nurse-PDF/CSV for Periode 3?
