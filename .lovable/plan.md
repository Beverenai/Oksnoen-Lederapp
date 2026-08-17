# Leirskole: fleksible økter, ukeplanlegger og chat-fiks

## 1. Custom 3. økt og custom aktiviteter
- I Leirskole-admin (fanen Økter) kan admin legge til egne økter for en dag: navn, klokkeslett, type (økt/måltid/annet), antall ledere. Ikke bare de faste malene.
- Siste økt (Økt 3) opprettes som **tom / ikke publisert** som standard: den vises som «Ikke satt» for lederne, og admin kan fylle den ut og publisere den senere på dagen. Generatoren hopper over upubliserte økter til de publiseres.
- Aktiviteter til 3. økt kan legges inn fritt: admin kan opprette en aktivitet direkte fra økt-visningen (den lagres i aktivitetslista) og knytte den til økten.

## 2. Ukeplanlegger (sommerleir-rutenett)
- Ny side under Leirskole-admin: rutenett med dagene som kolonner (Lørdag–Fredag) og radene 1, 2, 3 + en rad for legging, som i regnearket.
- Hver rute er fritekst (flere linjer, f.eks. «Klatring - 3») og kan farges (rød / oransje / nøytral) for å markere type/status.
- Autolagring per rute, alle ledere i uka kan se planen (les-only), admin redigerer.
- Egen tabell for rutene, knyttet til uke + dag + rad.

## 3. Justere klokkeslett / forskyve dagen
- Admin kan endre start- og sluttid på hver økt og hvert måltid direkte i lista.
- Knapp «Forskyv dagen» med valg (±15 / ±30 / ±60 min) som flytter alle økter den dagen samtidig, og en variant for hele uka.
- Varighet, nattevakt-flagg og timeregnskap oppdateres automatisk, og vaktplanen kan regenereres etter forskyvningen.

## 4. Fikse Lederhuset / sending av melding
- Feildialogen viser i dag bare «Kunne ikke sende melding» og skjuler den faktiske årsaken. Første steg er å vise den reelle feilmeldingen (og logge den), så vi ser om det er tilgangsregler, kanal-mismatch eller nevn-varsling som feiler.
- Årsaken er ikke bekreftet ennå: kontoen i skjermbildet har admin-rolle, som normalt har skrivetilgang til leirskole-kanalen, så vi må lese den faktiske feilen før vi retter. Sannsynlige kandidater vi sjekker: at «Se som»-modus sender med feil leder-id, og at nevn-/svar-feltene brekker innsettingen.
- Deretter rettes selve årsaken og sending testes i begge kanaler (Lederhuset og Leirskole).

## Teknisk
- `leirskole_posts`: nye felt for publisert-status og «custom»-flagg; migrasjon + RLS/grants som i dag (admin skriver, staff leser).
- Ny tabell `leirskole_week_plan_cells` (week_id, date/day_index, row_index, text, color) med samme tilgangsmønster.
- `generate-leirskole-schedule` respekterer upubliserte økter og oppdaterte tider; kapasitetsgrenser (2 på måltid, 4 på Sanitas) beholdes.
- Chat: bedre feilhåndtering i `src/pages/Chat.tsx` før fiks, så vi ikke gjetter.
