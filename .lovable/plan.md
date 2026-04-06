

## Fullskjerm-fiks: Dekk hele iPhone-skjermen uten gap

### Hva er galt

1. **Bunnavigasjonen** har `bottom: calc(2px + env(safe-area-inset-bottom))` + `left: 8px` + `right: 8px` + `border-radius: 20px`. Dette gir en pill som flyter over bunnen — men bakgrunnen under pillen er svart/tom fordi ingenting dekker det området.

2. **Dupliserte CSS-regler** for `html, body, #root` — finnes på linje 58-65 (utenfor `@layer`) OG linje 234-262 (inne i `@layer base`). De konflikter og gjør at `height` og `overflow` ikke oppfører seg konsistent.

3. **Main content** har `pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+24px)]` — den `24px` er for mye padding for en pill som sitter tett på bunnen.

### Brukerens ønske

Brukeren vil ha en **standard iOS tab bar** som strekker seg helt ned til bunnen — INGEN pill, INGEN gap, INGEN border-radius. Bakgrunnsfargen skal gå helt til bunnen av skjermen.

### Endringer

**1. `index.html` — viewport meta er allerede korrekt** (har `viewport-fit=cover`). Apple PWA meta-tags er også på plass. Ingen endring nødvendig.

**2. `src/index.css` — Konsolider og fiks**

- **Fjern** dupliserte `html, body, #root`-regler på linje 57-65 (beholdes kun i `@layer base`)
- **Oppdater `@layer base`-reglene** (linje 234-262) til brukerens eksakte kode
- **Erstatt `.bottom-nav`** (linje 370-391) med flat tab bar:
```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: hsla(var(--card), 0.92);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid hsl(var(--border));
  border-radius: 0;
  z-index: 50;
}
```
- **Oppdater `.app-content`** padding-bottom til `calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))`

**3. `src/components/layout/AppLayout.tsx`**

- Linje 835: Endre main `pb-[...]` fra `calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+24px)` til `calc(var(--nav-h)+env(safe-area-inset-bottom,0px))` — fjerner de ekstra 24px

### Filer som endres
- `src/index.css` — konsolider html/body/root, flat tab bar, riktig content padding
- `src/components/layout/AppLayout.tsx` — fjern overflødig bottom-padding

### Resultat
- Tab bar strekker seg helt ned til bunnen av skjermen
- Bakgrunnsfargen fortsetter under home indicator via `padding-bottom: env(safe-area-inset-bottom)`
- Ingen svart/hvit stripe under navigasjonen
- Midtknappen (Hajolo/Admin/Nurse FAB) beholdes som den er — den stikker fortsatt opp over tab bar
- Glassmorfisk bakgrunn beholdes (blur + transparency) men uten border-radius

