# Bedre lederlogikk i admin + samlet Leirskole-styring

## Problem 1: skjermen «hopper» når du endrer rolle

Rolleendring i lederkortet lagres automatisk, og når den er lagret ber den admin-siden om å hente data på nytt. Den oppfriskningen setter hele siden i «laster»-modus, som river ned lederkortet du står i midt i endringen. Derfor virker det som ingenting skjedde, og du må gjøre det flere ganger.

**Fix**
- Skille mellom første lasting (skjelett) og senere oppfriskning (stille, i bakgrunnen) — lederkortet forblir åpent.
- Rollen oppdateres umiddelbart lokalt i listen, så badgen endrer seg med én gang.
- Kortere/tydeligere lagring: liten «Lagrer… / Lagret»-indikator ved rollevalget, og feilmelding med tilbakestilling hvis det feiler.
- Rollevalget låses mens lagringen pågår, så doble trykk ikke skaper konkurrerende kall.

## Problem 2: Leirskole-tilgang er spredt

I dag må man gjøre to ting på to steder: gi lederen rollen «leirskole» i lederkortet, og legge lederen inn på den aktive leirskoleuken i Leirskole-admin. Er bare én av dem gjort, får lederen feil app eller mangler chat/vakter.

**Ny «Leirskole-tilgang»-seksjon i Leirskole-admin (øverst)**
- Én liste over alle ledere med søk, der én bryter per leder = «på leirskole».
- Slår du bryteren på: lederen legges på den aktive uken **og** får leirskole-tilgang automatisk. Slår du av: begge fjernes.
- Tydelige statuslinjer per leder: på uken, har leirskole-tilgang, aktiv i periode (aktiv i periode = ser hele appen, ikke bare leirskole).
- Toppkort med telling: X ledere på leirskole, Y har full tilgang som admin, Z mangler noe — pluss en «Fiks alle»-knapp som retter opp de som mangler rolle.
- Kort forklaring i seksjonen om hva som gir hva, slik at det ikke er noe å huske.

Admin/superadmin/nurse beholder sin rolle (de mister ikke admin ved å bli satt på leirskole) — de kan bytte visning manuelt via visningsvelgeren.

## Teknisk

- `src/pages/admin/AdminSettings.tsx`: `loadData({ quiet })` — `isLoading` settes kun ved første last; legg til lokal `updateLeaderInList` for optimistisk rolle/felt-oppdatering.
- `src/components/admin/LeaderDetailDialog.tsx`: rollelagring via `manage-roles` beholdes, men med lagringsstatus (`idle | saving | saved | error`), disabled radiogruppe under lagring, og `onSaved` kalles med «quiet»-flagg.
- Ny komponent `src/components/admin/LeirskoleAccessCard.tsx` brukt i `src/pages/admin/LeirskoleAdmin.tsx`: leser `leaders` + `get_all_leader_roles` + `leirskole_staff` for aktiv uke; bryter kjører `leirskole_staff` insert/delete og `manage-roles` (`add`/`remove` med rolle `leirskole`) i samme handling, deretter invalidering av `['leirskole-staff']` og rollelisten.
- Ingen databasemigrasjoner nødvendig.
