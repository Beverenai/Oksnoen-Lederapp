## Problem

I `TeamsTab.tsx` ligger navn + poeng + +/- knapper + "..." på én rad (`flex items-center gap-2`). På mobil blir raden for trang: lagnavnet (med `flex-1`) skyver kontroll-gruppen mot kanten, knappene (`h-7 w-7`) krymper, og popover-triggeren blir vanskelig/umulig å treffe. Derfor får man ikke lagt til poeng fra telefon.

## Løsning

Rediger kun `src/components/stats/TeamsTab.tsx` (leaderboard-raden ~L430–475). Ingen datalogikk endres.

1. Splitt raden i to linjer på mobil:
   - Linje 1: rank + fargeprikk + lagnavn + totalpoeng-badge.
   - Linje 2: full-bredde kontroll-rad med `Minus` / bonus-tall / `Plus` / `BonusAmountPopover`, høyrejustert.
   - På `sm:` og oppover: behold én-linje layout som i dag.

2. Gjør knappene lettere å trykke på mobil:
   - `Minus` / `Plus` / `MoreHorizontal`: `h-9 w-9` på mobil, `sm:h-7 sm:w-7` på desktop.
   - Legg til `shrink-0` på hele kontroll-gruppen og på total-badge slik at ingenting krymper bort.
   - `touch-manipulation` på knappene for å hindre 300ms tap-delay.

3. Sørg for at `BonusAmountPopover` fungerer på mobil:
   - `PopoverContent` med `align="end"` og `sideOffset={6}`, `className="w-[calc(100vw-2rem)] max-w-xs"` slik at popoveren ikke går utenfor viewport.
   - Grid av forhåndsvalg: `grid-cols-4` med `h-10` knapper på mobil for bedre trykkflate.
   - Custom-input: `type="number" inputMode="numeric"` (allerede der) — behold, men gjør `Input` `h-10` og `Legg til`-knappen `h-10` på mobil.

4. Fjern duplisert "bonus"-linje under raden (L463–467) siden bonuspoenget nå alltid vises i kontroll-raden.

## Verifikasjon

- Sett preview til mobil-viewport og bekreft at +/-/... er trykkbare og popover åpner innenfor skjermen.
- Trykk +1 og bekreft at totalen øker (optimistisk update finnes allerede i `adjustBonus`).

Ingen migrasjoner, ingen backend-endringer.