## Diagnose: hvorfor 65 advarsler?

Validatoren rapporterer kun *leder + dag + regel* — ikke hvilke vakter som kolliderer. Alle 65 er sannsynligvis **11t-hvile-brudd**, fordi generatoren plasserer:

| Kollisjon | Hvile | Antall pr. dag |
|---|---|---|
| `legging` (slutt 01:00) → `personalmoete` 10:45 neste dag | 9t 45m | ~17 ledere (team1+team2) |
| `nattevakt` (slutt 05:00) → `okt1` 11:00 neste dag | 6t | 2 ledere |
| `legging_ankomst` (slutt 01:00 dag 1) → PM1 dag 1 | 9t 45m | 17 ledere |

Over 7 dager → 60+ brudd.

## Reglene som skal håndheves

**A. Legging-ledere (slutter 01:00):** Har fri til **PM2 (15:45)** neste dag. Skal ikke plasseres i: vekking, frokost, PM1, økt1, middag, bings/seilern/morgenvakt/kjøkken neste dag.

**B. Tidligvakt-unntak:** Én leder per team som har "tidlig morgen" neste dag (PM1 10:45) skal **ikke** gjøre legging — i stedet **slutte 23:45** dagen før (okt3 forkortes til 23:45, eller egen "tidligvakt-avslutning"). Sikrer 11t hvile (23:45 → 10:45 = 11t).

**C. Nattevakt-ledere (slutter 05:00):** Har fri til **etter 16:00** neste dag. Skal ikke plasseres i noe før okt2 (16:00). 11t hvile fra 05:00 = 16:00, så okt2-start er OK.

## Endringer

### `supabase/functions/generate-shift-schedule/index.ts`

1. **Track per dag hvem som var i legging og nattevakt forrige dag.** Bygg `prevLeggingIds: Set<string>` og `prevNattIds: Set<string>` ved starten av hver dag-iterasjon basert på allerede pushede vakter.

2. **Ekskluder `prevLeggingIds` fra disse team-vaktene på gjeldende dag** (legg til i `excluded`-array i hvert `pushTeam`-kall):
   - `vekking` (08:30)
   - `frokost` (09:00)
   - `personalmoete` (10:45)
   - `okt1` (11:00)
   - `middag` (14:00)
   
   Også for leder-vakter samme tidspunkt: hopp over kandidater i `prevLeggingIds` (morgenvakt, frokost-leder, bings_morgen, seilern_box, kjokkenvakt).

3. **Ekskluder `prevNattIds` fra alle vakter før kl 16:00** på gjeldende dag — i praksis alt unntatt `personalmoete2`, `okt2` og senere.

4. **Tidligvakt-mekanisme for legging-dagen:**
   - Når `legging` (22:00–01:00) skal pushes for et team, identifiser én leder som *trengs* i PM1 neste dag (en "kandidat for tidligvakt").
   - Ekskluder denne lederen fra `legging`. I stedet: opprett spesiell vakt-tildeling — enten ny `shift_type` `okt3_tidlig` (20:30–23:45, 3.25t) eller forkort `okt3` for kun denne lederen.
   - Enkleste implementasjon: pushe `okt3` som vanlig (slutter 00:00), men ekskluder tidligvakt-lederen fra `okt3` og legg dem på en ny `tidligvakt_avslutning`-vakt (f.eks. 22:00–23:45). Krever ny rad i `shift_types`.
   - Alternativ enklere variant: definer at "tidligvakt" kun teller innen okt3 og at lederen avslutter 23:45 — registrer som `okt3` med `note: 'avslutter 23:45'` og la validator se på `note` og redusere endAbs. (Mindre ren, men ingen schema-endring.)

### `supabase/functions/revalidate-shift-schedule/index.ts`

Speil samme `prevLeggingIds`/`prevNattIds`-logikk hvis vi velger å *undertrykke* advarsler i stedet for å fikse generatoren — men anbefalt: la validator forbli streng, og fikse generatoren slik at bruddene aldri oppstår.

Hvis vi tar `note`-varianten for tidligvakt: validator må parse `note` og bruke 23:45 som faktisk slutt for `okt3`-tildelinger med den noten.

### Migrasjon (kun hvis vi velger ny shift_type)

```sql
INSERT INTO shift_types (slug, name, day_type, start_time, end_time, duration_hours, sort_order)
VALUES ('tidligvakt_avslutning', 'Tidligvakt (avslutter 23:45)', 'normal', '22:00', '23:45', 1.75, 95);
```

## Beslutningspunkter før implementasjon

1. **Tidligvakt-modell:** Ny `shift_type` (renere, krever migrasjon) eller `note` på eksisterende `okt3` (ingen schema-endring, validator må endres)?
2. **Hvor mange tidligvakt-ledere per team?** Én totalt, eller én per team (team1 + team2 = 2)?
3. **Skal "tidligvakt" rotere** mellom ledere over perioden, eller kan samme person ha det flere dager?

## Forventet resultat

Etter implementasjon: 65 → ~0 advarsler (alle 11t-brudd løst ved riktig ekskludering). Eventuelle gjenværende advarsler er reelle problemer som krever manuell håndtering.
