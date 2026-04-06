

## Fix: Hjem-siden viser feil leder i "Se som"-modus

### Problem
Data-spørringene i Home.tsx bruker `effectiveLeader.id` korrekt, men **visningen** (navn, avatar, hilsen) bruker fortsatt `leader` direkte. Derfor ser du "Hei, August!" selv om du ser som en annen leder.

### Endringer

| Fil | Endring |
|-----|--------|
| `src/pages/Home.tsx` | Erstatt `leader?.name`, `leader?.profile_image_url` og `leader?.name?.split(' ')[0]` med `effectiveLeader` i visnings-seksjonen (linje 378-397). Også fiks realtime-subscription filter (linje 253) fra `leader.id` til `effectiveLeader.id`. |

Konkret endres:
- Linje 253: `leader.id` → `effectiveLeader?.id` i realtime-filter
- Linje 380: `leader?.name?.split(' ')[0]` → `effectiveLeader?.name?.split(' ')[0]`
- Linje 389: `leader?.profile_image_url` → `effectiveLeader?.profile_image_url`
- Linje 389: `alt={leader?.name}` → `alt={effectiveLeader?.name}`
- Linje 391: `leader?.name` og `leader.name` → `effectiveLeader?.name`
- Linje 396: `leader?.name` → `effectiveLeader?.name`

