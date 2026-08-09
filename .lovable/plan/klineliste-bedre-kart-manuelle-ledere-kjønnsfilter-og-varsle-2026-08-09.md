# Klineliste: bedre kart, manuelle ledere, kjønnsfilter og varsler

## 1. Kartet må tåle 100+ på telefon
Dagens kart plasserer alle på én sirkel med prosent-baserte avatarer. Med over 100 noder blir bildene mikroskopiske og linjene et garnnøste. Nytt kart:

- **Zoom og panorering**: kartet blir en flate du kan dra og pinche i (dobbelttrykk zoomer inn). Ute-zoomet ser du hele nettet, inn-zoomet ser du bilder og navn.
- **Automatisk plassering (force-layout)**: klynger av folk som er koblet havner nær hverandre, isolerte par legger seg i utkanten. Mye mer lesbart enn én stor sirkel.
- **Detaljnivå etter zoom**: langt ute = fargede prikker med størrelse etter antall koblinger, nærmere = profilbilde, helt inne = bilde + fornavn.
- **Fokusmodus**: trykk på en person → bare hen og koblingene hens lyser opp, resten dempes. Trykk igjen for å gå ut.
- **Søk**: søkefelt over kartet som zoomer rett til personen.
- **"Mitt nett"-knapp**: viser bare deg og de du er koblet til i flere ledd.
- **Listevisning som alternativ**: veksle mellom Kart og Liste (alle koblinger som par-rader) — alltid lesbart uansett antall.

## 2. Kjønnsfilter (gutter / jenter)
Filterchips over kartet: **Alle · Gutter · Jenter**. Ledere har ikke kjønn lagret i dag, så vi legger til et kjønnsfelt på leder, forhåndsutfylt automatisk fra fornavn (samme navnelogikk appen alt bruker), og redigerbart av admin og av lederen selv i profilen. Ukjent kjønn vises i "Alle".

Filteret gjelder også toppliste og listevisning, med to ekstra visninger: topp gutter og topp jenter.

## 3. Legge inn en leder manuelt
Ny knapp i "Ny kobling": **Legg til leder manuelt**. Du skriver fullt navn (og eventuelt kjønn), og personen kan brukes som kobling med én gang — laget for gamle ledere som ikke er i appen lenger.

- Manuelle ledere har ikke konto, så en kobling mot dem kan ikke bekreftes av dem. Den blir stående som **bekreftet av den som la den inn**, og vises i kartet med et lite merke som viser at motparten er manuelt lagt inn.
- De vises kun i Klineliste — ikke i Ledere, vaktplaner, hendelser, varsler eller andre lister.
- Admin kan redigere navn/kjønn og slette manuelle ledere (koblingene deres slettes med).

## 4. Varsler for koblinger
- Når noen sender deg en kobling: push **"X vil legge deg inn i klinelista"** som åpner Klineliste → Mine.
- Når noen bekrefter din forespørsel: push **"X bekreftet koblingen"**.
- Avslag gir ingen push.
- Varslene sendes server-side, så ingen kan sende falske varsler i andres navn, og hver forespørsel/bekreftelse gir maks ett varsel.

## 5. Uleste varsler på app-ikonet
App-ikonet får et rødt tall (badge) med antall uleste ting som venter på deg: innkommende klinekoblinger, uleste postkassesvar og ubesvarte drapsmeldinger i Morder-leken. Tallet settes av serveren ved utsending og oppdateres/nullstilles når du åpner appen. Fungerer på iOS-appen og på installert web-app; nettlesere uten støtte ignorerer det uten feil.

## Teknisk

**Database (én migrasjon)**
- `leaders`: nye kolonner `gender text` (`male|female|null`) og `is_external boolean not null default false`.
- Backfill `gender` fra navnelisten der den gir sikkert treff.
- `leader_hookups`: RLS oppdateres slik at `INSERT` med `status='confirmed'` bare er lovlig når motparten har `is_external = true`.
- Ny tabell `hookup_notifications` (unik på `hookup_id` + `kind`) som send-lås, samme mønster som `murder_death_notifications`.
- Ny SECURITY DEFINER-funksjon `get_my_unread_badge()` for badge-tallet.
- GRANT til `authenticated` + `service_role` på alt nytt.

**Filtrering av eksterne**
- `useLeaders`/`useAllLeaders` får `.eq('is_external', false)`; ny `useKlinelisteLeaders()` inkluderer eksterne. Push-funksjoner får samme filter, så eksterne aldri regnes som mottakere.

**Frontend**
- `src/components/klineliste/HookupGraph.tsx` skrives om: SVG i et zoom/pan-lag (pointer-events for drag + pinch), enkel force-simulering i `src/lib/hookupLayout.ts` (memoisert), LOD etter zoomnivå, fokus- og søkelogikk.
- `src/components/klineliste/HookupList.tsx` (ny) — listevisning.
- `src/components/klineliste/AddExternalLeaderSheet.tsx` (ny).
- `src/pages/Klineliste.tsx` — kjønnschips, Kart/Liste-veksling, admin-seksjon for manuelle ledere.
- `src/hooks/useHookups.ts` — mutasjon for ekstern kobling, kall til varselfunksjon etter request/confirm.
- `src/hooks/useAppBadge.ts` (ny) — `navigator.setAppBadge/clearAppBadge` + oppdatering ved app-fokus; kobles inn i `AppLayout`.

**Edge function**
- `supabase/functions/push-hookup/index.ts` (ny): validerer JWT, utleder avsender fra `current_leader_id`, finner mottaker fra `hookup_id`, tar send-lås i `hookup_notifications`, sender web push + APNs med `badge`. Gjenbruker VAPID/APNs-oppsettet fra `push-murder-death`.
- `push-send` og øvrige push-funksjoner får `badge` med i APNs-payloaden.
- Ny destinasjon `/klineliste` i `src/lib/pushDestinations.ts`.