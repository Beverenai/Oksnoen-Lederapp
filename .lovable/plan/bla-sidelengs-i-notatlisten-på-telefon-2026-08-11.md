# Bla sidelengs i notatlisten på telefon

## Problem
I notat-panelet (admin) ligger notat-chipsene i en vannrett rad øverst på telefon. Raden bruker samme `ScrollArea`-komponent som er laget for vertikal rulling: den har bare vertikal rullelinje, og innholdet pakkes i et element med `display: table`, som gjør at fingersveip sidelengs ikke oppfører seg som forventet i mobilnettleser/iOS-appen.

## Løsning
Bytt den vannrette chip-raden til vanlig nettleser-scroll sidelengs, som iOS håndterer nativt:

- Erstatt `ScrollArea` rundt chip-raden med en enkel `div` med `overflow-x-auto`, `touch-action: pan-x` og momentum-scroll (`-webkit-overflow-scrolling: touch`).
- Skjul rullelinjen visuelt (tynn/ingen strek) og legg inn litt luft i kantene så første og siste chip ikke klippes.
- Chips får `shrink-0` og `whitespace-nowrap` slik at raden faktisk blir bredere enn skjermen og kan dras.
- Aktivt notat rulles automatisk inn i synsfeltet når man bytter notat, så valgt chip alltid er synlig.
- Ingen endring på PC — sidepanelet med den vertikale listen er uendret.

## Teknisk
- `src/components/admin/notes/AdminNotesPanel.tsx`: bytt ut den mobile `ScrollArea` (chip-raden) med native horisontal scroll-container; behold `NoteRow`-komponenten, legg til `ref`/`scrollIntoView` for aktiv chip.
- `src/index.css`: legg til en liten hjelpeklasse for skjult rullelinje (`.no-scrollbar`) hvis den ikke finnes, i tråd med eksisterende mønster.
- Ingen databaseendringer.
