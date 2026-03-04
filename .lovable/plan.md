

## Problem: Admin-siden scroller ikke på mobil

### Årsak

Rot-elementet i `AppLayout` bruker `min-h-screen flex flex-col`. Problemet er at `min-h-screen` lar containeren **vokse ubegrenset** i høyden, noe som betyr at `<main>` med `flex-1` og `overflow-y: auto` aldri får en fast høydebegrensning. Uten fast høyde ignorerer nettleseren `overflow-y: auto` og innholdet bare utvider seg uten scrollbar.

### Løsning

Endre rot-`<div>` i `AppLayout.tsx` fra:
```
min-h-screen flex flex-col
```
til:
```
h-dvh flex flex-col overflow-hidden
```

`h-dvh` (dynamic viewport height) gir en fast høyde som respekterer iOS Safari sin dynamiske adresselinje. `overflow-hidden` hindrer selve rot-elementet fra å scrolle, slik at bare `<main>` (med `.app-content` sin `overflow-y: auto`) håndterer scrolling.

### Fil som endres

| Fil | Endring |
|-----|---------|
| `src/components/layout/AppLayout.tsx` (linje 395) | `min-h-screen` → `h-dvh overflow-hidden` |

