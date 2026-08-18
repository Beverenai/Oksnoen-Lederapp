# Egne økter, ukeplan-generering og lønnseksport for leirskole

## 1. Egne økter når som helst i dagen

I dag kan egne økter bare lages på ankomst-/avreisedager. Det åpnes for alle dager.

- Ny knapp «+ Egen økt» i dagkolonnen i ukeplanen (Hele uken) og i dagsvisningen.
- Skjema: navn (f.eks. «Badevakt»), starttid, sluttid, antall ledere.
- Økten legges inn i riktig rekkefølge etter klokkeslett — altså mellom Økt 1 og Middag hvis tiden tilsier det.
- Ledere legges til/fjernes på samme måte som i vanlige økter, inkludert beskjed per leder.
- Timene teller fullt: de legges til lederens dagstotal, vises i timeoversikten og utløser advarsel hvis dagen går over grensen (8 t).
- Egne økter krever ikke aktivitet, og «Fikse»-knappen tar hensyn til dem når den rydder timer.

## 2. Uken delt inn i økter med aktiviteter, vist øverst

- Ukeplanleggeren (økt 1–2–3 per dag med aktiviteter og farger) flyttes opp som en kompakt stripe øverst i ukevisningen, over vaktrutenettet — samme oppsett som regnearket ditt: dager bortover, økt 1/2/3 nedover.
- Stripen kan slås sammen/ut, og aktiviteter velges fra aktivitetslista (samme som i dag) med farge per rute.
- Egne økter på en dag vises som egne rader i stripen for den dagen.

## 3. Generer uken ut fra planen

- Ny knapp «Generer fra ukeplan» over ukevisningen.
- Den leser aktivitetene som står i hver økt i planen og bemanner øktene ut fra det: nok ledere til aktivitetene, riktig kompetanse der det kreves, maks timer per dag og 11 timers hvile.
- Før noe lagres vises en forhåndsvisning der du velger:
  - **Fyll tomme plasser** — behold alt som er lagt inn manuelt.
  - **Lag på nytt** — erstatt alt automatisk generert; låste dager og manuelle vakter beholdes.
- Etter kjøring vises samme oppsummering som i dag (hvor mange vakter/aktiviteter som ble laget, og hva som mangler).

## 4. Eksport for regnskap og lønn

To knapper i leirskole-admin:

- **Denne uken (Excel)** — ett ark «Sammendrag» med én rad per leder: antall dager på vakt, antall økter, totale timer, timer på kjøkken/natt, samt ett ark «Detaljer» med én rad per vakt (dato, øktnavn, klokkeslett, timer, aktivitet, beskjed).
- **Hele sesongen (Excel)** — ark «Totalt» med sum dager/økter/timer per leder på tvers av alle uker, pluss ett ark per uke med samme sammendrag.

Egne økter er inkludert i alle tall.

## Teknisk

- **Database (migrasjon):** ingen nye tabeller nødvendig. `leirskole_posts.is_custom` brukes for egne økter; `leirskole_week_plan_cells` er allerede planen. Legger til en indeks på `(week_id, date, start_time)` for sortering.
- `LeirskoleWeekBoard.tsx`: bytt statisk `BOARD_ROWS` med rader beregnet fra måltider + økt 1–3 + egne økter sortert på `start_time`; ukeplan-stripe øverst; ny generer-knapp.
- `LeirskoleWeekPlanCard.tsx`: kompakt «stripe»-variant som gjenbrukes øverst i ukevisningen; tillat egne økter på alle dagtyper.
- `useLeirskole.ts`: `useAddLeirskolePost` utvides med `sortOrder`/valgfri aktivitet; ny `useUpdateLeirskolePost` for tid/navn.
- `leirskoleDayHours.ts` / `leirskoleValidate.ts`: inkluder egne økter i timer og advarsler.
- Ny `src/lib/exportLeirskolePayrollXlsx.ts` med ExcelJS (samme mønster som `exportShiftScheduleXlsx.ts`), knapper i `LeirskoleAdmin.tsx`.
- `leirskoleGenerateAll.ts` + `generate-leirskole-schedule`: les planceller som kilde til aktiviteter, og støtt modus `fill` vs `rebuild` fra forhåndsvisningen.
