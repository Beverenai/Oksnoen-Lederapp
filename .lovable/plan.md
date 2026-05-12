## Forbedre estetikk på admin-lederkort

To små justeringer i `src/components/admin/LeaderCard.tsx`:

### 1. Fornavn på én linje
- Bytte `break-words` → `truncate` så lange fornavn (Christine, Sarah, Anniken) ikke wrapper over flere linjer.
- Senke desktop font-størrelse fra `sm:text-base` → `sm:text-sm` (mobil beholder `text-xs`).
- Resultat: fornavnet vises alltid på én linje med ellipsis hvis ekstremt langt.

### 2. Profilbilde fyller hele ringen
- Fjerne `border-2 border-primary/20` fra `<Avatar>` (det er denne lyse grønne ringen rundt bildet i skjermbildet).
- Legge til `object-cover` på `<AvatarImage>` for å sikre at bildet alltid fyller sirkelen uten hvit kant.
- Beholde fallback-bakgrunn (initialer) for ledere uten bilde.

Ingen andre endringer — bare disse to estetiske finpussene.
