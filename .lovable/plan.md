## Avvik mot v5-spec — funnet i koden og databasen

### A. Database (`shift_types`) — feil tider/varigheter

| Slug | Nå | Spec v5 |
|------|----|---------|
| `nattevakt` | 23:30–05:00, 5.5t | **23:30–04:00, 4.5t** |
| `sanitas_box` | 23:30–05:00, 5.5t (kombinert) | **Splittes i to:** `sanitas` 23:30–01:00 1.5t (Økt 1-team) + `seilern_box` 09:15–10:00 0.75t (UNDER18A) |
| `seilern` | 09:15–10:00 (eksisterer) | Skal **slettes / smeltes inn i `seilern_box`** (Excel-korreksjonen sier dette er ÉN kolonne). |

### B. Generator-logikk (`generate-shift-schedule/index.ts`) — feil tildelinger

1. **Nattevakt-pool er feil.** Velger fra `[...team1, ...team2]`. Spec: **kun fra Økt 1-teamet (`morning18`)**. Også dette gjør at "nattevakt-leder unntatt middag (*)"-eksklusjonen i `middag` ikke alltid treffer.
2. **Legging er på feil team.** Koden gjør `pushTeam('legging', p.evening18, …)`. Spec: **Legging = Økt 1-team (`morning18`)** (de kommer tilbake etter 6t pause). Evening18 har Økt 3, ikke Legging.
3. **Sanitas er på feil personer.** Tildeles nattevakt-paret. Spec: **2 fra leggeteamet (Økt 1-team), IKKE nattevakt-paret**.
4. **Seilern+Box er ikke kombinert.** Skal være ÉN kolonne med 2 fra UNDER18A. Slug: `seilern_box`.
5. **Kveldsmat har F-team.** Koden pusher `p.morgenF` (UNDER18A) til kveldsmat. Spec: **kun Økt 2+3-team, ingen F-team** (under-18 er ferdige etter Økt 2).
6. **"Frokostvakt fra neste dag" mangler i PM1, Økt 1, PM2, Økt 2, Kveldsmat.** Spec: 1 person fra evening18 (= neste dags frokostvakt) deltar i PM1 → Økt 1 → PM2 → Økt 2 → Kveldsmat, men IKKE Økt 3 (*****).
7. **`tomorrow.frokost` er feilaktig pushet til Middag.** Spec: den personen er på Økt 1, ikke på Middag. Skal fjernes fra middag-blokken.
8. **`*****`-regelen (Økt 3 uten neste-dags-frokostvakt) er ikke implementert** — pga. punkt 6 finnes personen ikke i okt3-blokken, men note-merket bør være `*****` (ikke `****` slik det står nå på okt3).
9. **Personalmøte 1** mangler `neste_frokostvakt` (samme som punkt 6).
10. **Resten av Økt 2+3-teamet (evening18) skal IKKE være på PM1.** ✓ Allerede riktig.
11. **Kveldsmat-noten mangler.** Skal bare være `evening18`, men kommentaren "+ UNDER18A***" må fjernes.

### C. Excel-eksport (`exportShiftScheduleXlsx.ts`)

- Bruker fortsatt `seilern` + `sanitas_box` som separate slugs i `NORMAL_SLUGS`. Må oppdateres til `sanitas` + `seilern_box` (i denne rekkefølgen, etter Nattevakt og før Kjøkkenvakt).
- Navneformat — `shortName(fullName)` mangler. Skal vise "Fornavn E.": `"Caroline Røthe Skjaker" → "Caroline R.S."`.

### D. Mindre rydding

- Fjern den redundante `kjøkken-i-morgenF`-eksklusjonen i `vekking` og `frokost` (kjøkken kommer alltid fra `bingsF`).
- Bytt `okt3`-noten fra `****` til `*****`.

---

## Implementasjonsplan

**Migrasjon `update_shift_types_v5_times.sql`:**
- `UPDATE shift_types SET end_time='04:00', duration_hours=4.5 WHERE slug='nattevakt' AND day_type='normal'`
- Slett `sanitas_box`-raden og `seilern`-raden.
- Insert `sanitas` (23:30–01:00, 1.5t, requires_18_plus=true, min 2) og `seilern_box` (09:15–10:00, 0.75t, min 2).

**`supabase/functions/generate-shift-schedule/index.ts`:**
1. Endre nattevakt-pool: `nattPool = grouped[morning18]` + behold mix-logikken bare hvis vi vil tillate fra evening18 som backup. Spec sier strengt morning18.
2. Legg til `nesteFrokost` i `DayPlan`. Beregnes som `pickFairest(grouped[evening18], 1, busy)` — separat fra dagens egen frokost.
3. **PM1**: legg til `pushLeader(d, dt, 'personalmoete', p.nesteFrokost, 'frokostvakt_neste_dag')`.
4. **Økt 1**: legg til `pushLeader(d, dt, 'okt1', p.nesteFrokost, 'frokostvakt_neste_dag')`.
5. **Middag**: fjern `tomorrow.frokost`-pushet. Beholder morning18* + UNDER18B (uten kjøkken).
6. **PM2**: alle 4 team — uendret (`nesteFrokost` er allerede i evening18-blokken).
7. **Økt 2**: legg til `pushLeader(d, dt, 'okt2', p.nesteFrokost, 'frokostvakt_neste_dag')`. (Han er allerede i evening18-blokken? Nei — evening18 jobber Økt 2 som hel-team via `pushTeam('okt2', p.evening18)`. Men koden pusher ikke evening18 til Økt 2 i dag — sjekk: linje 401 `pushTeam('okt2', p.morning18)` — det er *Økt 1+2-teamet*. evening18 (Økt 2+3-team) skal også være med. Re-sjekkes: Spec sier Økt 2 = Økt 2+3-team + UNDER18A*** + UNDER18B. Koden pusher `morning18` til Økt 2 — det er feil! Skal være `evening18`.) → **Bug 12: Økt 2 har feil team!**
8. **Kveldsmat**: fjern `morgenF`-pushet, behold kun `evening18`.
9. **Økt 3**: bytt note til `*****`. Behold evening18, ekskluder `[p.nesteFrokost]`.
10. **Legging**: bytt fra `p.evening18` til `p.morning18`, ekskluder nattevakt-paret. Note `****`.
11. **Sanitas**: nytt block — `pickFairest(grouped[morning18], 2, busy excluding natt)`, push som `pushLeader(d, dt, 'sanitas', l, 'sanitas')`.
12. **Seilern+Box**: bytt slug fra `seilern` til `seilern_box`. Behold p.seilern fra UNDER18A.
13. Fjern de redundante kjøkken-eksklusjonene i `vekking`/`frokost`-pushene.
14. Sørg for at `seilern_box` upserten i koden matcher den nye DB-raden (ellers blir den overskrevet).

**`src/lib/exportShiftScheduleXlsx.ts`:**
- I `NORMAL_SLUGS`: bytt rekkefølgen siste 3 til `…'nattevakt', 'sanitas', 'seilern_box', 'kjokkenvakt'`.
- Legg til `shortName(fullName: string): string` og bruk i `cellLines` for leader-navn (også for `note`).

---

## Spørsmål før jeg bygger

1. **Bug 12 (Økt 2 på feil team)**: Bekreft at Økt 2 skal være `evening18` (Økt 2+3-team) + UNDER18A*** + UNDER18B — ikke `morning18`. Spec sier dette, men det vil endre alle vaktdager mye, så jeg vil være sikker.
2. **Nattevakt-pool**: skal vi være strenge ("kun morning18") eller tillate fallback til evening18 hvis morning18 har for få?
3. **Sanitas-eksklusjon**: skal sanitas-paret også ekskluderes fra Legging-team-pushet (de jobber Sanitas 23:30–01:00 = overlapper Legging slutt), eller står de markert i begge?

Når du svarer på disse 3, gjør jeg alle endringene over i ett pass og deployer.