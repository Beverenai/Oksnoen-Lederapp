
## Fiks: desktop-bredden må aldri gå utenfor viewport

### Rotårsaken
Dette ser ut til å komme fra `AppLayout.tsx`: `<main>` har både `lg:ml-64` og `w-full`. På desktop betyr det i praksis:
- innholdet er 100% bredt
- og så skyves det 64px/16rem til høyre i tillegg

Siden sidebaren er `fixed` og ikke tar plass i normal layout, blir totalbredden større enn skjermen. Derfor må du zoome ut for å se hele appen.

### Endringer
**1. Gjør desktop-layouten faktisk responsiv i `src/components/layout/AppLayout.tsx`**
- Ikke bruk `lg:ml-64` på `<main>` lenger
- Reserver plass til sidebaren på en trygg måte, f.eks. på outer wrapper med `lg:pl-64`
- La `<main>` være `w-full min-w-0 max-w-full overflow-x-hidden`
- Behold én scroll-container (`main`) så mobil/PWA-oppsettet ikke brytes

**2. Gjør content-wrapperen dynamisk i stedet for “for bred”**
- Ikke prøv å løse dette ved å bare øke `max-w`
- Sett inner-wrapper til å følge tilgjengelig plass: full bredde innenfor området til høyre for sidebaren, med sentrering og fornuftig maksgrense
- Legg til `min-w-0` så grid/flex-innhold ikke presser layouten utover skjermen

**3. Sikre at Ledere-siden ikke lager ekstra bredde**
- I `src/pages/Leaders.tsx`, behold `overflow-x-hidden`
- Legg til/verifiser `w-full min-w-0` på toppcontainer
- La kun filter-chip-raden være horisontalt scrollbar der det er meningen, ikke hele siden

### Filer som endres
- `src/components/layout/AppLayout.tsx`
- `src/pages/Leaders.tsx`

### Teknisk retning
```text
Før:
viewport = 100%
main = 100% + margin-left(64)

Etter:
viewport = 100%
layout wrapper reserverer 64 for sidebar
main = resterende bredde
content = max 100% av tilgjengelig plass
```

### Resultat
- Appen går aldri utenfor skjermbredden på PC
- Ingen “langt ut til høyre”-layout
- Ingen behov for å zoome ut
- Ledere-siden skal fortsatt kunne scrolle normalt
- Mobil/PWA-oppsettet beholdes
