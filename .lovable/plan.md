

## Fiks: Suksessmeldinger som toast + minimal bunn-gap

### To problemer

**1. StatusPopup er for intrusiv for suksessmeldinger**
`StatusPopup` viser en fullskjerm-overlay med backdrop, stor ikon, og OK-knapp — midt på skjermen. For suksess og info er dette overkill. Feilmeldinger kan fortsatt bruke denne stilen (de krever oppmerksomhet).

**2. For mye plass under pill-menyen**
`bottom: calc(4px + env(safe-area-inset-bottom))` — safe-area er 34px på Face ID-iPhoner, så pillen sitter 38px over bunnen. Vi reduserer til `2px + safe-area` for minimal gap.

### Endringer

**1. `src/hooks/useStatusPopup.tsx` — Suksess/info bruker sonner toast i stedet**

`showSuccess` og `showInfo` kaller `toast.success()` / `toast()` fra sonner i stedet for å sette `popup`-state. Sonner er allerede konfigurert med `position="top-center"` og safe-area offset.

- `showSuccess` → `toast.success(title, { description: message, duration: 2000 })`
- `showInfo` → `toast(title, { description: message, duration: autoClose ?? 3000 })`
- `showError` beholdes som StatusPopup (krever brukerinteraksjon)
- Haptic feedback beholdes for alle

**2. `src/components/ui/sonner.tsx` — Flytt toast-posisjon**

Endre `position` fra `"top-center"` til `"bottom-center"` med offset som plasserer toasten rett over pill-menyen. Da unngår vi at den kuttes av på toppen.

```
offset="calc(80px + env(safe-area-inset-bottom, 0px))"
position="bottom-center"
```

**3. `src/index.css` — Reduser pill-gap**

`.bottom-nav` `bottom`: `calc(4px + ...)` → `calc(2px + env(safe-area-inset-bottom, 0px))`

### Filer som endres
- `src/hooks/useStatusPopup.tsx`
- `src/components/ui/sonner.tsx`
- `src/index.css`

### Resultat
- Suksessmeldinger vises som diskret toast over menyen, forsvinner etter 2 sek
- Feilmeldinger forblir fullskjerm-popup som krever OK/handling
- Toasts kuttes ikke av på toppen
- Pill-menyen sitter tettere mot bunnen

