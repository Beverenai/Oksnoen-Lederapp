## Kompakt hytte-chip: "Første hytte + antall"

**Fil:** `src/pages/Leaders.tsx` (kun leder-listen)

### Endring i `formatCabinsDisplay` (linje 171–174)
```ts
const formatCabinsDisplay = (cabins: CabinInfo[] | undefined): string => {
  if (!cabins || cabins.length === 0) return '';
  if (cabins.length === 1) return cabins[0].name;
  return `${cabins[0].name} +${cabins.length - 1}`;
};
```

Resultat:
- 1 hytte: `Beritbu front`
- 2 hytter: `Beritbu front +1`
- 4 hytter: `Beritbu front +3`

### Chip-styling i kort (linje 549–556)
Beholder enkel-linje. Legger til `whitespace-nowrap` og `max-w-[140px] truncate` på chip-spanet så veldig lange enkeltnavn også kuttes pent — `+N` suffikset står alltid synlig fordi det er en del av tekststrengen som truncates fra slutten? Da risikerer vi å miste `+3`. Bedre: splitte i to spans:

```tsx
<span className="bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-md border border-border leading-none flex items-center h-4 gap-1 max-w-[160px]">
  <Home className="w-2.5 h-2.5 shrink-0" />
  <span className="truncate">{leader.linkedCabins[0].name}</span>
  {leader.linkedCabins.length > 1 && (
    <span className="shrink-0 font-bold">+{leader.linkedCabins.length - 1}</span>
  )}
</span>
```

Da kuttes første navn med "…", og `+3` står alltid synlig.

### Full liste fortsatt tilgjengelig
Full hytteliste vises uendret i detalj-sheet (`LeaderDetailSheet` / `LeaderContentSheet`) ved tap på kortet. Ingen endring der.

### Ikke berørt
- Backend, RLS, filtre, sortering, andre formaterings-funksjoner i `LeaderDetailDialog`/`LeaderDetailSheet`.