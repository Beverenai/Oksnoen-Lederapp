# Skuddsikker leirskole-vaktplan

Målet: ukeplanen skal være trygg å endre, lett å lese, og aldri overraske deg når du trykker «Generer uken».

## 1. To visningsmoduser i ukebordet

Ny bryter øverst i «Hele uken»:

- **Kompakt** – dagens tette bord, for å se hele uken på én skjerm.
- **Stor** – større ruter, større navn og aktivitetstekst, tydeligere skiller mellom økter og måltider, ingen avkortede navn.

Valget huskes lokalt, så du slipper å bytte hver gang.

## 2. Ny fane: Ledere gjennom uken

Egen oversikt der hver **rad er en leder** og kolonnene er dagene:

```text
Leder      Man    Tir    Ons    Tor    Fre   | Sum
Caroline   Kjøk   Ø1 Ø2  Ø3     —      Natt  | 31t
Mats       Ø1 Ø3  Sanit  Ø2     Ø1 Ø2  —     | 27t
```

Per celle: hvilke økter/måltid/natt/kjøkken, med timer. Per leder: totaltimer for uken, dager uten vakt, og et rødt merke ved brudd på 8t-taket eller 11t hvile. Filtrering på leder og dag.

## 3. Raskere redigering av en økt

Redigeringspanelet for en rute får:

- Aktivitet og ledere i **samme visning** – velg aktivitet, se straks hvem som kan ta den.
- Lederliste sortert etter **kan ta aktiviteten** → **er på vakt** → **har timer igjen**, med badge for timer brukt i dag/uken.
- Tydelige varsler direkte i panelet: «dobbeltbooket i Økt 2», «over 8 timer», «for kort hvile siden nattevakt».
- Én-klikks handlinger: legg til leder, bytt leder, fjern aktivitet, dupliser aktivitet til neste dag.
- Panelet lukkes ikke etter hver endring, så du kan sette opp hele økten i én økt av klikking.

## 4. Konflikt- og dekningsvarsler i bordet

Øverst i «Hele uken» erstattes dagens ene grønne linje med en statuslinje som viser antall problemer, gruppert:

- aktiviteter uten leder
- ledere over 8 timer per dag
- brudd på 11 timers hvile
- dobbeltbooking (samme leder i to ting samtidig)
- måltid/natt/sanitas/kjøkken uten bemanning

Hver linje er klikkbar og hopper til den aktuelle ruten. Ruter med problem får rød kant, så du ser dem i bordet også.

## 5. Trygg generering

«Generer uken» får en forhåndsvisning før noe skrives:

- Viser hva som blir **opprettet, endret og slettet**, per dag.
- Låste dager og manuelt satte ruter listes eksplisitt som «beholdes urørt».
- Egne valg: «bare tomme ruter» (standard) eller «regenerer ulåste dager».
- Etter kjøring: én «Angre generering»-knapp som ruller tilbake til tilstanden rett før kjøringen.

## Teknisk

- `LeirskoleWeekBoard.tsx` splittes: `useLeirskoleBoardData` (avledede maps), `LeirskoleBoardRow`, `LeirskoleLeaderWeekTable` (ny fane), `LeirskoleBoardIssues` (varselpanel). Filen er 1240 linjer i dag og deles for å holde endringene trygge.
- Ny `src/lib/leirskoleValidate.ts`: ren funksjon som tar poster, aktiviteter, kjøkkendager og staff og returnerer en typet liste av issues (`type`, `date`, `session`, `leaderId`, `message`). Brukes både i varselpanelet, i redigeringspanelet og i generator-forhåndsvisningen — samme regler overalt.
- Timer/hvile gjenbruker `leirskoleDayHours.ts` og reglene i `leirskoleAutoAssign.ts` framfor nye kopier.
- `runLeirskoleGenerate` i `leirskoleGenerateAll.ts` får `dryRun: true` som returnerer planlagte endringer uten skriving; UI viser dem, og bekreftelse kjører samme kode med `dryRun: false`. Angre lagres som en snapshot i minnet av poster/assignments/aktiviteter for uken.
- Ingen databaseendringer nødvendig; kun ny kolonneuavhengig lesing/skriving mot eksisterende tabeller.
- Visningsmodus lagres i `localStorage`, ingen skjemaendring.
