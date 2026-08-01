## Hva jeg fant

Dette er ikke gamle data som henger igjen fra en tidligere periode. Alt i Periode 6 er korrekt merket med periodens ID, og de eldre 450 aktivitetene ligger fortsatt trygt på Periode 5.

Det som finnes i Periode 6 er registreringer gjort i går (31. juli), alle av samme leder — **August Raae Frisvold**, mest sannsynlig testing:

| Deltaker | Registrert |
|---|---|
| Augusta Josefine Dahl | Åtte meter (17:42), insj-poeng 2 |
| Maria Bjercke-Henriksen | Vannski x2, Skrikeren begge veier (19:05–19:06), insj-poeng 1, profilbilde lastet opp 19:06 |

Ingen bonuspoeng er gitt. Ingen andre av de 190 deltakerne har aktivitet, poeng eller bilde.

## Forslag til opprydding

1. Slette de 4 aktivitetsradene i Periode 6.
2. Nullstille insj-poeng (2 og 1) for de to deltakerne.
3. Fjerne profilbildet på Maria Bjercke-Henriksen (og bildefilen i lagringen), slik at alle starter uten bilde.

Etter det er Periode 6 helt blank: 0 aktiviteter, 0 poeng, 0 bilder.

## Teknisk

Utføres som en dataendring mot `participant_activities` (slett der `period_id` = aktiv periode) og `participants` (`insj_points = 0`, `image_url`/`image_thumb_url` = null for de to). Ingen kodeendringer nødvendig — det er ingen feil i logikken.

Vil du at jeg også skal si til August at han bør bruke arkiv/testmodus, eller er det greit?
