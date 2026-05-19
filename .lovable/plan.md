## 1. Profilbilder fyller hele ringen

**Fil:** `src/components/ui/avatar.tsx` (linje 22)

Den globale CSS-regelen `img { object-fit: contain }` i `index.css` overstyrer Radix sin standard, så bildene letterboxes inni avataren (synlig gap mellom bilde og fargeringen).

Fiks: legg `object-cover` på `AvatarImage`-default:
```tsx
<AvatarPrimitive.Image
  ref={ref}
  className={cn("aspect-square h-full w-full object-cover", className)}
  {...props}
/>
```

Dette gjelder hele appen automatisk — alle steder som bruker `<AvatarImage>` får riktig fylt rundt bilde.

## 2. Team + hytte over aktiviteten + kompakt team-badge

**Fil:** `src/pages/Leaders.tsx`

**a. Kompakt team-label** (linje 74–81): Endre `formatTeamDisplay` til kun å returnere short-koden:
```ts
const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const t = team.trim();
  if (['1', '2', '1f', '2f'].includes(t.toLowerCase())) return t.toUpperCase();
  return t; // 'Kjøkken', 'Kordinator' osv. uendret
};
```
Resultat: i kortet vises bare "1", "2", "1F", "2F" med team-farge — tar minimal plass.

**b. Flytt badges over aktivitet** (linje 519–562): Rekkefølge på info-kolonnen:
1. Navn (uendret)
2. Ministerpost (uendret)
3. **Badges** (team + hytte) — flytt opp fra under aktiviteten, plasseres rett under ministerpost med `mt-1.5`.
4. Aktivitet — beholder skillelinjen (`mt-2 pt-2 border-t border-border/50`) under badges.

## Ikke endret
- Ring-farge-logikk, telefonknapp, sortering, filtre, backend.
- Andre avatar-bruk fortsetter å fungere — de drar fordel av samme fiks.