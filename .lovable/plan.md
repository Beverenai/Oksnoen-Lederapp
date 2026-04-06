

## Fiks: Meny, scroll, layout og safe area

### Endringer

**1. Sidemenyen → 80vw med overlay (`AppLayout.tsx` linje 551-656)**
- Legg til en `bg-black/50` overlay-div bak menypanelet som fader inn/ut. Klikk på overlay → `closeMobileMenu()`.
- Meny-panelet endres fra `fixed inset-0` til `fixed inset-y-0 right-0 w-[80vw] max-w-[320px]`.
- Meny-headeren endres fra `left-0 right-0` til bare full bredde innenfor panelet.
- Animasjon beholdes: `translate-x-full` → `translate-x-0`.

**2. Svart stripe → safe area på bunnav (`AppLayout.tsx` linje 660)**
- Legg til `pb-[env(safe-area-inset-bottom,0px)]` på `<nav>` og sørg for at bakgrunnen strekker seg ned.
- CSS-klassen `.bottom-nav` i `index.css` bruker allerede `bottom: calc(8px + env(...))` — men selve nav-elementet trenger intern padding for å unngå at innholdet kuttes.

**3. Main content padding (`AppLayout.tsx` linje 794)**
- Endre `pb-[env(safe-area-inset-bottom,0px)]` til `pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+24px)]` slik at innhold aldri havner bak den flytende bunnav-baren.

**4. Scroll-ytelse på Leaders (`Leaders.tsx` linje 349)**
- Legg til `overflow-x-hidden` og style `WebkitOverflowScrolling: 'touch'`, `overscrollBehavior: 'contain'`, `willChange: 'transform'` på scroll-containeren.

**5. Viewport-fix (`index.css`)**
- Verifiser at `html, body, #root` bruker `min-height: 100dvh` (allerede delvis på plass, dobbeltsjekker).

### Filer som endres
- `src/components/layout/AppLayout.tsx`
- `src/pages/Leaders.tsx`
- `src/index.css` (kun om `100dvh` mangler)

### Resultat
- Meny dekker 80% med dimmet bakgrunn bak
- Ingen svart stripe på iPhone
- Innhold kuttes ikke av bunnav
- Smooth scroll på Ledere-siden

