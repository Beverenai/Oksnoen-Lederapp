

## Fix: Søk viser deltakere med notater + scroll, og helseinfo-flagging

### Problem
1. Søkefeltet filtrerer ikke og viser ingen resultater — det bare prøver å scrolle til en match. Brukeren vil se en liste over deltakere som har notater og klikke for å scrolle dit.
2. `syncParticipantHealth` bruker `participant_health_info` men logikken for å oppdatere/sjekke er fragil (sjekker `startsWith('[Nurse]')`) — må verifiseres at den faktisk flagger deltakere korrekt i "Viktig Info"-siden.

### Løsning

**1. Søk med dropdown-resultater (linje 601-610)**

Erstatt det nåværende `Input`-søkefeltet med en søkbar dropdown:
- Når brukeren skriver i søkefeltet, vis en dropdown under med deltakere som **har notater** i rapporten og matcher søketeksten
- Hver rad viser deltakernavn, hytte, og antall notater
- Klikk på en rad scroller ned til deltaker-kortet (`nurse-section-{id}`) med smooth scroll og en kort highlight-animasjon
- Tomt søkefelt = ingen dropdown (ikke vis alle)
- Klikk utenfor lukker dropdown

**2. Helseinfo-flagging (linje 258-317)**

`syncParticipantHealth`-funksjonen ser korrekt ut — den upserter til `participant_health_info`. Men den sjekker `existingInfo[0].info.startsWith('[Nurse]')` som betyr at hvis deltakeren allerede har manuell helseinfo (ikke fra nurse), opprettes det ikke noe nytt. Fix:
- Hvis deltakeren har eksisterende helseinfo som IKKE starter med `[Nurse]`, **append** nurse-info til eksisterende info med en linjeskift-separator, i stedet for å ignorere den
- Sørg for at ved sletting av siste notat, kun nurse-delen fjernes fra helseinfo (ikke hele infoen)

### Fil som endres

| Fil | Endring |
|-----|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Søk-dropdown med deltakere som har notater + scroll-to, fix helseinfo append-logikk |

