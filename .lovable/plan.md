## Mål

Nattevakt skal kun jobbe Økt 1 + selve nattevakta — ingen andre fellesvakter den dagen. Total blir 3,0 + 5,5 = 8,5 t (akseptert regel for nattevakt).

I tillegg: rette opp tegnforklaring (asterisker) og sikre at frokostvakt fortsatt droppes fra middag.

## Endringer i `supabase/functions/generate-shift-schedule/index.ts`

**Ekskluder nattevakt-paret (`p.natt`) fra følgende team-vakter på samme dag:**

| Vakt | I dag | Etter |
|---|---|---|
| Personalmøte 1 (10:45) | inkluderer natt | **ekskluder natt** |
| Økt 1 (11:00–14:00) | inkluderer natt | inkluderer natt (uendret) |
| Middag (14:00–15:30) | ekskluderer natt | uendret |
| Personalmøte 2 (15:45) | inkluderer natt | **ekskluder natt** |
| Legging (22:00–01:00) | ekskluderer natt | uendret |

Konkret: legg til `...p.natt` i `excluded`-arrayene for `personalmoete` (linje 438, kun `p.morning18`-pushet), og `personalmoete2` (linje 458, kun `p.morning18`-pushet).

For `personalmoete2` som i dag pusher alle 4 team i en løkke, splittes den slik at `p.morning18` får `p.natt` ekskludert mens de andre tre teamene pushes som før.

**8t-cap-håndtering:** `dayHoursIfAdded`-sjekken vil ellers automatisk ekskludere nattevakt fra alle tunge vakter (Økt 1 inkludert) når nattevakta legges inn først. For å beholde Økt 1 som eneste tillatte fellesvakt, hever vi taket til 8,6 t spesifikt for nattevakt-personer den dagen — eller (enklere) lar vi nattevakt-paret få et fast unntak fra cap-sjekken på den dagen de har nattevakt. Implementeres ved å registrere et `nattLeaderIds: Set<string>` per dag og hoppe over cap-sjekken i `pushTeam` for disse på `okt1`.

## Endring i `src/lib/exportShiftScheduleXlsx.ts`

Oppdater linje 197:

```diff
- '***** De som jobbet Økt 1 jobber IKKE legging',
+ '***** Den som jobbet første økt jobber IKKE legging',
```

(De fire andre asterisk-linjene matcher allerede ønsket tekst.)

## Resultat per nattevakt-person på en normal dag

| Vakt | Tid | Timer |
|---|---|---|
| Økt 1 | 11:00–14:00 | 3,00 |
| Nattevakt | 23:30–05:00 | 5,50 |
| **Sum** | | **8,50** |

`8h_max`-advarsel undertrykkes for nattevakt-personer på dagen de har natt (8,5 t er regelen). 11t-hvile fortsatt validert som før.

## Hva vi ikke endrer

- Frokostvakts ekskludering fra middag (`*`) — beholdes.
- Bings-, morgen- og kjøkkenvakts logikk — uendret.
- Sanitas-paret (eget pushLeader 23:30–01:00) — uendret.
- F-team 21:00-regel og 11t-hvile — uendret.