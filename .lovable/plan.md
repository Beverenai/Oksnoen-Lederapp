# Plan: Hard grense på 8 timer per leder per dag

## Regel
Ingen leder skal noen gang få tildelt mer enn 8 timer på én dag. Hvis en tildeling vil bryte grensen, må generatoren velge en annen leder eller ekskludere personen fra teamvakta.

## Endringer i `generate-shift-schedule`
1. **Live timeregnskap per leder per dag** under genereringen (union av intervaller, samme metode som UI bruker — så overlappende vakter ikke dobbelttelles).
2. **`pickFairest` blir `pickUnderCap`**: kandidater som ville passert 8t for spesialvakta filtreres bort før fairness-sorteringen. Hvis ingen er under taket, velges den med færrest timer (minst overskridelse) — men dette skal være siste utvei.
3. **Spesialvakter (morgen, frokost, bings, seilern, kjøkken, natt, sanitas, neste-frokost) tildeles først**, før team-vakter regnes inn — slik at vi vet hvor mye "rom" hver leder har igjen.
4. **Team-vakter ekskluderer automatisk** ledere som ville passert 8t. `pushTeam` får en intern sjekk: for hvert teammedlem, hvis `current_hours[day] + shift_duration > 8`, legg til i `excluded_leader_ids` for raden.
5. **`recordWork` oppdateres synkront** så timeregnskapet alltid er ferskt før neste tildeling.
6. **Beholder F-team-21:00 og 11t-hvile** som tilleggsregler, men 8t er den harde grensen.

## Endringer i `revalidate-shift-schedule` og UI
- Advarselen `8h_max` skal nå være ekstremt sjelden. Hvis den oppstår = bug eller faktisk umulig bemanning.
- UI viser timetabellen som før, men forventet maks blir 8.0.

## Hva vi ikke endrer
- `min_leaders` per spesialvakt respekteres fortsatt — hvis ingen leder kan ta vakta uten å bryte 8t, lar vi vakta gå over (med advarsel) i stedet for å la den stå tom.
- Vekking, frokost, måltider og personalmøter er korte (15–60 min) og rammer hele team — disse skal sjelden trigge ekskludering, men logikken behandler dem likt.

## Resultat
- Ingen leder over 8 t/dag i normal drift
- `Over 8t/dag`-advarsler forsvinner i praksis
- Hvis bemanningen er for tynn én dag, får dere en tydelig advarsel om hvilken vakt som ikke kunne fylles innenfor regelen — i stedet for stille overbelastning