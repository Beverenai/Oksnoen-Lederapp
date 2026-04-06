

## Fiks: Innhold kuttes av på kantene

### Rotårsak
I `src/pages/Leaders.tsx` linje 484 har leader-griden `overflow-hidden`. Avatarene har `ring-4` (4px ring utenfor elementet) som strekker seg utenfor kortets kant. Kombinert med `overflow-hidden` på griden blir venstre og høyre kant av ringene kuttet av.

Samme problem kan oppstå i `AppLayout.tsx` linje 835 der `<main>` har `overflow-x-hidden`.

### Endringer

**1. `src/pages/Leaders.tsx` linje 484 — Fjern `overflow-hidden` fra grid**
- Endre `<div className="grid gap-2 overflow-hidden">` til `<div className="grid gap-2">`
- Overflyt håndteres allerede av `overflow-x-hidden` på wrapper-div (linje 349) og `<main>` i AppLayout

**2. `src/pages/Leaders.tsx` linje 349 — Legg til litt ekstra padding for ring-overflow**
- Wrapper-div har allerede `overflow-x-hidden w-full min-w-0`
- Det holder som fallback — selve griden trenger bare ikke å klippe innholdet sitt

### Filer som endres
- `src/pages/Leaders.tsx` — fjern `overflow-hidden` fra grid-containeren

### Resultat
- Avatar-ringer og kortskygger kuttes ikke av på venstre/høyre kant
- Ingen horisontal scroll oppstår (håndteres av parent)
- Alle andre sider påvirkes ikke

