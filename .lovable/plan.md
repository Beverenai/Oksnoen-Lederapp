## Bygg "Ren hierarki"-kortet i `src/pages/Leaders.tsx`

Erstatter dagens leder-kort (linje 505–586) med valgt prototype-struktur. Beholder all eksisterende data, ring-farge-logikk, telefon-handler og semantiske tokens.

### Struktur (matcher valgt prototype)

```
Card  rounded-[24px]  shadow-sm  p-4
 └ flex items-center gap-4
    ├ Avatar 64×64  ring + ring-offset-2
    ├ Info (flex-1)
    │   ├ Navn      text-[17px] font-bold
    │   └ Minister  text-[11px] uppercase tracking-wider text-muted-foreground
    │   ├ Chips     h-4 rounded-md text-[10px] font-bold  (team m/farge + hytte m/Home-ikon)
    │   └ Aktivitet pt-1 border-t  •  grønn pulserende prikk + text-sm font-semibold
    └ Actions (gap-3)
        ├ Nurse-kors  22×22 (kun hvis isNurse)
        └ Telefon     w-11 h-11 grønn rund, shadow, active:scale-90
```

### Konkrete endringer
- **Card**: `rounded-[24px] shadow-sm border-slate-100`, CardContent `p-4`, root `flex items-center gap-4`.
- **Avatar**: `w-12 h-12` → `w-16 h-16` + `ring-offset-2 ring-offset-background`. Beholder `getAvatarBorderClass(leader)` (sjef=grønn, nurse, has_read osv.). Fallback får `font-semibold`.
- **Navn**: `text-lg` → `text-[17px] font-bold` i `<h3>` for semantikk.
- **Ministerpost**: kompakt meta — `text-[11px] font-medium uppercase tracking-wider text-muted-foreground`.
- **Chips**: byttes fra `<Badge>` til kompakt span med fast `h-4`, `rounded-md`, `text-[10px] font-bold`. Team-chip beholder `getTeamStyles()` for farge. Hytte-chip bruker `bg-muted`/`border-border` (semantiske tokens) + `Home` 10×10 ikon.
- **Aktivitet**: står alene under chips med `pt-1 border-t border-border/50`, prefiks med `1.5×1.5` grønn `animate-pulse` prikk, tekst `text-sm font-semibold` med truncate.
- **Actions-kolonne**: ny `flex items-center gap-3 shrink-0` som grupperer nurse-kors + telefon. Telefon-knappen vokser fra `h-9 w-9` → `h-11 w-11`, ikon 20px, `shadow-md`, `active:scale-90 transition-transform`.

### Ikke berørt
- `getAvatarBorderClass`, `getTeamStyles`, `formatTeamDisplay`, `formatCabinsDisplay`, sortering, filtre, "Fri"-separator, tom-tilstand, sheet-åpning, telefon-handler, RLS/backend.