# STEG 1: Database for vaktplan-systemet

Legger fundamentet for vaktplan-generatoren. Ingen UI eller logikk i dette steget — kun tabeller, seed-data og RLS. Etter dette kan vi trygt gå videre til STEG 2 (generator) og STEG 3 (admin-UI).

## Hva som lages

### 5 nye tabeller

1. **`shift_types`** — referanse for alle vakttyper (33 rader totalt)
   - 16 vakter for normal dag (morgenvakt, vekking, frokost, økt 1/2/3, middag, bings, personalmøter, kveldsmat, legging, nattevakt, kjøkkenvakt, m.fl.)
   - 9 vakter for ankomstdag (forberedelser, ankomst, intro, kiosk, m.fl.)
   - 8 vakter for avreisedag (rydding, utdeling pass, opprydning, m.fl.)
   - Hver vakt har klokkeslett, varighet, minimum antall ledere, 18+ krav

2. **`leader_teams`** — hvilket team en leder tilhører i en gitt periode
   - team1, team2 (18+ dagteam/kveldsteam)
   - team1f, team2f (under-18 F-team)
   - Per periode/år, så samme leder kan ha ulikt team i ulike perioder

3. **`shift_schedules`** — én rad per generert vaktplan (periode + år)
   - status: draft / published / archived
   - period_length: 7 eller 8 dager

4. **`shift_assignments`** — selve vakttildelingene
   - Knyttet til en schedule, en dag (0..n) og en vakttype
   - Enten team-tildeling (team_name) ELLER navngitt leder (leader_id)
   - Note-felt for asterisk-merknader (*, **, ***, ****, *****)

5. **`special_duties`** — register for spesialvakt-rotasjon
   - morgenvakt, bingsvakt, nattevakt, frokostvakt, kjøkkenvakt, sanitas, seilern_box
   - Brukes både av generator (rotasjon) og av leder-visning ("er jeg unntatt?")

### Tilgangsregler

- **Alle innloggede ledere** kan lese alle 5 tabellene (trenger det for å se sin egen vaktplan i STEG 4)
- **Kun admin/superadmin** kan opprette, endre eller slette rader

### Seed-data

Alle 33 vakttyper for normal/ankomst/avreise legges inn samtidig (i samme migrasjon) slik at systemet er klart til generator i STEG 2.

### Auto-update

`updated_at`-trigger på `shift_schedules` og `shift_assignments` så vi alltid vet når en plan ble sist endret.

## Tekniske detaljer

```text
shift_types
├── slug + day_type (unik kombinasjon, så samme slug kan finnes i normal og ankomst)
├── duration_hours numeric(3,2)
├── min_leaders int
└── requires_18_plus, all_must_attend bool

leader_teams
├── leader_id → leaders(id) ON DELETE CASCADE
├── unik(leader_id, period_number, year)
└── team CHECK i ('team1','team2','team1f','team2f')

shift_schedules
├── unik(period_number, year)
└── generated_by → leaders(id)

shift_assignments
├── schedule_id → shift_schedules ON DELETE CASCADE
├── shift_type_id → shift_types
├── leader_id → leaders (nullable, kun ved assignment_type='leader')
├── team_name (nullable, kun ved assignment_type='team')
└── index på (schedule_id, day_index)

special_duties
├── schedule_id → shift_schedules ON DELETE CASCADE
├── leader_id → leaders
└── unik(schedule_id, day_index, duty_type, leader_id)
```

RLS bruker eksisterende `is_admin()` security definer (allerede i prosjektet). Ingen rekursjonsrisiko.

## Hva som IKKE skjer i dette steget

- Ingen edge function (det er STEG 2)
- Ingen admin-side eller UI (STEG 3)
- Ingen leder-visning (STEG 4)
- Ingen endringer i eksisterende kode
- Ingen kobling til admin-dashboardet ennå

`src/integrations/supabase/types.ts` regenereres automatisk etter migrasjonen, så de nye tabellene blir tilgjengelige med full type-sikkerhet i React.

## Etterpå

Når dette er kjørt og typene er oppdatert, sier du bare "kjør STEG 2" så bygger jeg `generate-shift-schedule` edge function.
