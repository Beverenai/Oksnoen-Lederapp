# Leirskole: visuell vaktplan, lysere admin og enklere tilgang

## 1. Vaktplan med ansikter
Vaktplanen i admin («Vaktplan»-fanen) vises i dag som tekstlister. Den bygges om til visuelle dagskort:

- Hver dag = eget kort med farget dag-header (logo-gradient) og totaltimer.
- Hver post (Frokost, Økt 1–3, Middag, Kvelds, Nattevakt) får en rad med avatar-stack av lederne på vakt — profilbilde med initialer som fallback og «+N» når det er mange.
- Fargekoding etter posttype: måltid (grønn), økt (blå), natt (dyp blå), og tydelig rød markering når en post mangler ledere («mangler 2»).
- Trykk på en avatar åpner lederens vakt-ark med alle vakter og timer for uken.

## 2. Neste økt på leder-hjemskjermen
På leirskole-hjem (`/leirskole`):

- Øverst et «Neste vakt»-kort: dag, klokkeslett, posttype, din aktivitet for økten, timer i dag mot maks, og hvem du jobber sammen med (avatarer).
- Ny seksjon «Hvem jobber i dag»: horisontal avatarliste for dagens økter, trykkbar for å se den lederens vaktplan for uken.
- Egen vaktplan vises som kompakt dagsstripe med timer per dag.

## 3. Lysere og bedre admin-dashboard
Leirskole-temaet er i dag nesten helt mørkeblått. Uten å bytte identitet:

- Hev bakgrunn og kort noen steg i lyshet, øk kontrast på tekst og kantlinjer, og gjør gradientene mer dempet men mer fargerike (rød/grønn/blå/gul som aksenter).
- Admin-siden får klarere layout: kompakt uke-header med nøkkeltall (ledere, publisert-status, antall poster, snitt-timer), deretter samme faner, med luftigere kort og tydeligere primærhandlinger.
- «Generer vaktplan», «Generer dagen + varsle» og «Publiser» får tydelig plassering slik at det er åpenbart hva som brukes oftest.

## 4. Bedre leirskole-tilgang
Tilgangskortet blir en tydeligere liste:

- To seksjoner: «På leirskole denne uken» og «Andre ledere», med søk og teller.
- Legg til / fjern med tydelig knapp per leder i stedet for kun bryter, pluss hurtigvalg «Legg til alle aktive» og «Fjern alle» med bekreftelse.
- Optimistisk oppdatering slik at listen ikke hopper, og tydelig merking av ledere som beholder full app-tilgang (admin/nurse/superadmin).

## Teknisk
- `src/components/admin/LeirskolePostsCard.tsx`: nytt dags-/post-grid med avatarstack; mapper `staff_id` → leder via eksisterende `useLeirskoleSchedule` + `useLeirskoleStaff`.
- Ny komponent `src/components/leirskole/LeaderAvatarStack.tsx`, gjenbrukt i admin og på hjem.
- `src/pages/Leirskole.tsx`: «Neste vakt»-kort og kolleger-liste; utvidelse i `src/hooks/useLeirskole.ts` for å hente ukens poster med assignments.
- `src/pages/admin/LeirskoleAdmin.tsx`: layout/header-refaktor, ingen endring i generator-logikken.
- `src/index.css`: justerer `oks-leirskole-theme`-tokens (lysere `--background`/`--card`, sterkere `--border` og `--muted-foreground`) og gradientvarianter.
- `src/components/admin/LeirskoleAccessCard.tsx`: seksjonering, bulk-handlinger og optimistisk mutasjon.
- Ingen databaseendringer nødvendig.