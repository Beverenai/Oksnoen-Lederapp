

## Fjern `[Nurse]`-prefiks fra helseinformasjon

### Problem
Når nurse lagrer info, legges `[Nurse]` foran teksten i databasen (f.eks. `[Nurse] sover dårlig`). Dette er overflødig siden seksjonen allerede heter "Info fra Nurse".

### Endring

| Fil | Endring |
|-----|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Linje 302: Endre `nurseTag` fra `` `[Nurse] ${allText}` `` til bare `allText`. Oppdater regex på linje 314 til å matche uten `[Nurse]`-prefix, eller fjern replace-logikken og bare sett hele feltet til `allText`. |

Konkret: Fjern `[Nurse]`-taggen ved lagring, slik at kun selve teksten lagres i `participant_health_info.info`. Eksisterende data med `[Nurse]`-prefix vil fortsatt vises korrekt — vi kan også strippe prefixet ved visning i `ParticipantDetailDialog` som fallback.

### Fallback i visning
I `ParticipantDetailDialog.tsx` (linje ~231): Strip eventuell `[Nurse] ` prefix fra `healthInfo.info` ved rendering, slik at eksisterende data også vises rent.

