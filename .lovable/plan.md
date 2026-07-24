## Endringer på /mer-siden

### 1. Header (mobil, øverst)
- Bytt ut den trunkerte teksten «August Raae Frisv…» øverst til høyre med en liten rund avatar (profilbilde) som lenker til `/profile`. Fallback: initialer i sirkel hvis lederen mangler bilde.
- Logo til venstre beholdes uendret.
- Ingen endringer i header for andre sider — kun `/mer`.

### 2. Side-tittel
- Erstatt «Mer / Alle sider og funksjoner» med en personlig hilsen:
  - Overskrift: `Hei, {fornavn} 👋`
  - Undertekst: «Alle sider og funksjoner»
- Fornavn hentes fra `leader.name` (splitt på første mellomrom).

### 3. Stor sentrert Admin-knapp (kun admin)
- Rett under hilsenen, over rutenettet, vises en fremhevet full-bredde Admin-CTA — kun synlig når `isAdmin`.
- Design: primær bakgrunn, Shield/Settings-ikon, tekst «Admin», stor tappbar høyde (~64px), samme border-radius som flisene.
- Klikk navigerer til `/admin`.
- Admin-flisen fjernes fra rutenettet for admins (for å unngå duplikat). For alle andre roller er ingenting endret.

### Filer som berøres
- `src/pages/More.tsx`: bytte header-navn til avatar-lenke, oppdatere tittel-blokk, legge til admin-CTA, fjerne Admin-flis fra grid når `isAdmin`.

Ingen endringer i `AppLayout.tsx`, ruter eller data.
