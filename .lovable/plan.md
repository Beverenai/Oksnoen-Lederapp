## 1. Admin leder-sheet: tilbake-knapp, X større, safe-area-toppadding

**Fil:** `src/components/admin/LeaderContentSheet.tsx` (linje 608–632)

- Bytt ut/utvid `SheetHeader` slik at den får topp-safe-area-padding: `pt-[calc(env(safe-area-inset-top)+0.5rem)]`.
- Legg til en stor "Tilbake"-knapp øverst (venstrejustert, `<ChevronLeft>` ikon + tekst "Tilbake", min 44×44 touch-target) som kaller samme `handleSheetOpenChange(false)`-flyt. Plasseres over avatar-raden.
- Erstatt standard liten X (fra `sheet.tsx`) ved å rendre vår egen lukkeknapp i headeren — minst `h-10 w-10` med `h-6 w-6` ikon, plassert i øvre høyre hjørne med samme safe-area-offset.
- For å unngå at standard-X dukker opp dobbelt: legg `[&_button[type=button]:has(svg.lucide-x)]:hidden`-trick eller (renere) bytt `SheetContent`-importen for å skjule innebygd close. Enkleste: legg `className="[&>button.absolute]:hidden"` på `SheetContent`.

## 2. Scroll skal aldri låses

**Fil:** `src/components/admin/LeaderContentSheet.tsx` (linje 611, 699–703)

- Sørg for at `SheetContent` ikke har `overflow: hidden` på iOS. Bytt fra `overflow-y-auto` på selve `SheetContent` til en intern scroll-wrapper `<div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch overscroll-contain">` rundt body-innholdet, så headeren ligger stille.
- Fjern `onWheel`/`onTouchMove` stopPropagation som ligger inni popover-listen (linje 700–702) — disse blokkerer naturlig scroll når brukeren prøver å scrolle utenfor popover.
- Sjekk at `body` ikke får varig `overflow: hidden` igjen etter at sheet lukkes (Radix gjør dette automatisk, men bekreft via DOM-inspeksjon).

## 3. Sjefer alltid med grønn ring

**Fil:** `src/pages/Leaders.tsx` (linje 287–295)

Legg til regel før red default:
```ts
const isSjef = leader.team?.toLowerCase() === 'sjef';
if (isSjef) return 'ring-4 ring-green-500';
```
Plasseres etter kitchen/fri-sjekkene, før admin/nurse/has_read-regelen (eller flettes inn — sjef-team trumfer "ikke lest").

## 4. Ledere-kort: tydeligere hierarki

**Fil:** `src/pages/Leaders.tsx` (linje 519–562)

Nåværende: rolle-label → navn → aktivitet → badges, alt limt sammen. Skap visuelt skille mellom **identitet** (navn + rolle) og **status** (aktivitet):

```
┌─────────────────────────────────┐
│ 🟢 Navn (text-lg, semibold)     │
│    Statsminister (xs muted)     │
│ ─────────────────────────────── │  ← border-top eller mt-2 luft
│ Slutt å leke (base, bold)       │
│ [Sjef] [Hytte]                  │
└─────────────────────────────────┘
```

Konkret:
- Navn: `text-lg font-semibold text-foreground leading-tight` (øverst).
- Ministerpost: `text-xs text-muted-foreground truncate mt-0.5` (under navn, ikke uppercase label).
- Aktivitet: i en egen blokk `mt-2 pt-2 border-t border-border/50` med tekst `text-sm font-bold text-foreground truncate`. Bordet gir det visuelle skillet brukeren etterspør.
- Badges: `mt-2`, uendret styling.

Resultat: navn dominerer øverst, rolle er liten metadata, og aktiviteten står klart adskilt under en svak skillelinje slik at det aldri blandes med navnet.

## Ikke endret
- Backend, RLS, datahenting, telefon-knapp, FAB, bunnmeny.
- Andre sheets/dialoger som ikke ble nevnt.