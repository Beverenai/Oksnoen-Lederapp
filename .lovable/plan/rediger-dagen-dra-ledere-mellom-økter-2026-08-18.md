# Rediger dagen: dra ledere mellom økter

## Slik blir det

**1. «I dag»-kortet blir en full dagsredigering**
Kortet nederst i Leirskole-admin (som i dag bare viser dagens vakter) blir redigerbart. Du velger dag med dagspillene som allerede finnes, og jobber deretter fritt med den dagen — uken beholdes uendret som oversikt i ukebordet over.

**2. Rediger økten**
Hver økt i dagslisten kan endres direkte:
- Navn på økten (f.eks. «Økt 2» → «Klatring med gruppe B»).
- Start- og sluttid, med timetall som oppdateres automatisk.
- Slett økt, og «Ny økt» nederst (navn + tid) for noe som bare skjer den dagen.

**3. Dra ledere mellom økter**
Under dagslisten ligger en «Ledige ledere»-rad med alle lederne som jobber i uken. Du kan:
- Dra en leder fra raden inn i en økt.
- Dra en leder fra en økt til en annen (flytter vakten).
- Dra en leder tilbake til raden for å fjerne vakten.
- Alternativt trykke på lederen og velge økt i en liste — samme resultat, for de gangene dra ikke er praktisk på telefon.

Hver leder viser timer brukt i dag / maks timer, og blir rød når dagen overstiger taket eller lederen havner i to økter som overlapper i tid. Endringen lagres med en gang og vises live i ukeoversikten.

**4. Låst dag**
Er dagen låst, må du åpne låsen før du kan dra — knappen ligger i samme kort, slik at du ikke blir overrasket av at generatoren skriver over det du gjorde.

## Teknisk

- Ny `src/components/admin/LeirskoleDayEditor.tsx` som erstatter det statiske «I dag»-blokka i `src/pages/admin/LeirskoleAdmin.tsx` (linje ~515–576). Tar `week`, `staff`, valgt dato og dagens poster som props.
- Dra-og-slipp med `@dnd-kit/core` (allerede i prosjektet): hver økt er en `useDroppable`, hver lederbrikke en `useDraggable`. Droppable id = `post:<id>` og `pool`. Pointer- og touch-sensorer med liten aktiveringsavstand, slik at skroll fortsatt fungerer.
- Tildeling/fjerning skjer mot `leirskole_assignments` (insert/delete med `assigned_manually: true, is_locked: true`) — samme mønster som `LeirskolePostStaffPicker.tsx`, med optimistisk cache-patch på `['leirskole-schedule', weekId]` så timene endres uten flimmer.
- Navn/tid/slett/ny økt gjenbruker eksisterende `useUpdateLeirskolePost`, `useDeleteLeirskolePost` og `useAddLeirskolePost` i `src/hooks/useLeirskole.ts`. Ingen databaseendringer.
- Timer og overlapp beregnes med `leirskoleDayHours.ts` + `leirskoleValidate.ts` slik at varslene er identiske med ukebordet.
- Låsestatus leses/settes via `useLeirskoleWeekDays` / `useSetLeirskoleDayLock`.
