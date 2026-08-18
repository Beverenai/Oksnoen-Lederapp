# Dagsplanen bygges på «Dag til dag»

## Problemet i dag

Dagsvisningen og «Dag til dag» lever hver for seg. Aktiviteten til hver leder velges fritt inne på økten, uavhengig av hva som faktisk står i ukeplanen — derfor står det fire ledere på «Rebus» i Økt 3 tirsdag 18. aug, selv om ruten for den økten bare inneholder Rappellering, Klatring, Badevakt, Bruskasser og Flåtetur. Samme økt-rute har «Klatring ×2», men antallet blir ikke brukt: i Økt 1 samme dag står tre ledere på Rappellering enda ruten bare ber om én.

Det er også for mye å forholde seg til: en egen «Rediger»-modus, en «Uken går opp»-boks som alltid vises, og kjøkkenvakten øverst i dagen.

## Slik blir det

**Aktivitetene styrer øktene.** Hver økt i dagsvisningen viser plassene som er lagt inn i «Dag til dag» — «Klatring ×2» blir to Klatring-plasser, Kanotur blir én. Hver plass viser lederen som har den, eller står tom med et pluss.

```text
ØKT 1  11:00–14:00                      3.0t
 🧗 Klatring   🧗 Klatring   🛶 Kanotur   🛞 Tube
 [ Hedda ]     [   +    ]    [ Clara ]   [  +  ]

 Uten aktivitet: [ Mats ]  ← må få en plass eller tas av økten
```

- Trykk på en tom plass: velg blant lederne som er ledige i den økten (timer og advarsler vises som nå).
- Trykk på en leder: bytt leder, flytt til en annen plass, eller ta vedkommende av økten.
- Ledere som står på økten uten å ha en plass vises som «Uten aktivitet» og regnes som en konflikt.
- Vil du legge til flere plasser, gjøres det der aktivitetene bor — i «Dag til dag» — eller med «+ aktivitet» på økten, som skriver rett inn i samme rute. Ingen aktivitet kan lenger settes på en leder uten å finnes i planen.

**Genereringen følger samme regler.** Automatisk fordeling gir én leder per plass, respekterer ×N, finner aldri opp aktiviteter som ikke står i ruten, og dobler ikke opp samme aktivitet utover antallet. Gamle tildelinger som ikke finnes i ruten (som «Rebus») blir ryddet bort.

**Konflikter i stedet for kvittering.** «Uken går opp»-boksen fjernes. Det vises bare en boks når noe faktisk må løses — tomme plasser, ledere uten aktivitet, over timegrensen, dobbeltbooking — med en «Løs»-knapp som fyller tomme plasser med ledige ledere og fjerner tildelinger som ikke hører til i planen.

**Kjøkken nederst.** Kjøkkenvakt-seksjonen flyttes til nederst i dagen, med samme funksjon (ledere, timer, fjern).

**«Rediger»-knappen fjernes.** Alt endres direkte: pluss legger til, trykk på en leder endrer, og navn/tid på økten endres ved å trykke på tittelen eller klokkeslettet.

## Teknisk

- `LeirskoleDaySessions.tsx` bygges om: `cellInstances(lines, types, assignments)` fra `leirskoleCellInstances.ts` blir kilden til plassene per økt (rad 1–3 → formiddag/ettermiddag/kveld), i stedet for «én rute per assignment med fri aktivitetsvelger». Kjøkkenblokken flyttes til slutten, `editMode` fjernes.
- Å sette en leder på en plass skriver både `leirskole_assignments` (vakt på økten) og `leirskole_activity_assignments` (aktivitet for økten) i én operasjon, så de aldri kommer i utakt.
- `leirskoleAutoActivity.ts`: fjern «spare»-logikken som legger inn aktiviteter utenfor ruten, respekter antall per aktivitet, og slett aktivitetstildelinger som ikke finnes i ruten for økten.
- `LeirskoleWeekImpact.tsx` viser kun ved konflikter og får en «Løs»-handling; suksesstilstanden rendres ikke.
- Økter uten aktiviteter (måltid, Sanitas, Nattevakt) beholder dagens enkle lederliste.
