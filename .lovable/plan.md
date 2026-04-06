

## Fix: `adminIds.has is not a function`

### Problem
React Query persistence (added for offline support) serializes cached data to `localStorage`. JavaScript `Set` objects cannot survive JSON serialization — they become plain objects. When the cache is restored, `roles.adminIds` is no longer a `Set`, so `.has()` fails.

### Løsning
Endre `useLeaderRoles` til å returnere vanlige arrays i stedet for `Set`. Konverter til `Set` først ved bruk i `useLeaderDashboardData`, slik at det alltid er en ekte `Set` uavhengig av om data kommer fra cache eller nettverk.

### Endring

| Fil | Endring |
|-----|--------|
| `src/hooks/useLeaderDashboardData.ts` | I `useLeaderRoles`: returner arrays (`adminIds: string[]`, `nurseIds: string[]`) i stedet for `Set`. I `useLeaderDashboardData`: konverter til `Set` med `new Set(roles?.adminIds ?? [])`. |

Konkret:
- Linje 22-23: `new Set(...)` → bare `.map(r => r.leader_id)` (returner array)
- Linje 46-47: `roles?.adminIds ?? new Set()` → `new Set(roles?.adminIds ?? [])` (konverter array til Set)

