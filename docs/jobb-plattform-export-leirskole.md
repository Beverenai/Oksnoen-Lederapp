# Kobling mot jobbplattformen

Lederappen henter leirskoleuker og ansatte fra Lovable-prosjektet
`oksnoen-leder-flow` via en privat Edge Function:

```text
POST https://hiifcjletsoklagflnvn.supabase.co/functions/v1/export-leirskole
x-sync-secret: <LEIRSKOLE_SYNC_SECRET>
```

Begge Supabase-prosjektene skal ha samme, tilfeldig genererte
`LEIRSKOLE_SYNC_SECRET`. Nøkkelen skal ikke ligge i kode, dokumentasjon,
commit-meldinger eller logger. Roter nøkkelen i begge prosjektene dersom den
har blitt delt eller brukt som en kort testkode.

## Datakilde

Eksporten skal bruke de faktiske tabellene i jobbplattformen:

- `leirskole_weeks` for navn, datoer og beskrivelse
- `leirskole_applications` for bemanning
- `profiles` for lederens navn
- `leirskole_week_availability` for tilgjengelighet
- `schedule_posts` for vaktposter
- `schedule_assignments` for vaktfordeling

Kun søknader med status `accepted` eller `contracted` er ansatte og kan
eksporteres. Statusene `applied` og `offered` betyr ikke at personen har
akseptert jobben.

## Kontrakt

```json
{
  "contract_version": 2,
  "full_snapshot": true,
  "weeks": [
    {
      "external_ref": "<leirskole_weeks.id>",
      "name": "Uke 34",
      "start_date": "2026-08-17",
      "end_date": "2026-08-21",
      "notes": null,
      "source_schedule_published_at": "2026-08-16T18:00:00.000Z",
      "staff": [
        {
          "external_ref": "<profiles.id>",
          "name": "Fornavn Etternavn",
          "role_label": "Leder",
          "max_daily_hours": 8,
          "employment_status": "hired",
          "availability": [
            {
              "date": "2026-08-18",
              "available": true,
              "from_time": "09:00:00",
              "to_time": "20:00:00"
            }
          ]
        }
      ],
      "posts": [
        {
          "external_ref": "<schedule_posts.id>",
          "date": "2026-08-18",
          "name": "Økt 1",
          "post_type": "activity",
          "start_time": "11:00:00",
          "end_time": "14:00:00",
          "crosses_midnight": false,
          "required_leaders": 4,
          "is_main_shift": true,
          "is_night": false,
          "sort_order": 6,
          "notes": null
        }
      ],
      "assignments": [
        {
          "external_ref": "<schedule_assignments.id>",
          "post_ref": "<schedule_posts.id>",
          "leader_ref": "<profiles.id>",
          "is_locked": false,
          "assigned_manually": false
        }
      ]
    }
  ]
}
```

`full_snapshot: true` betyr at bemanning og vaktplan er komplette. Lederappen
kan da fjerne synkroniserte personer, poster og tildelinger som ikke lenger
finnes i kilden. Innhold admin har lagt til manuelt i lederappen berøres ikke.

`external_ref` for ansatte skal være `profiles.id`, ikke søknads-ID-en. Da
kan en manuell kobling til appbrukeren gjenbrukes på tvers av flere uker.
Eksporten skal ikke inneholde e-post, telefon, fødselsdato, søknadstekst eller
andre personopplysninger.

Tilgjengelighet hentes fra `leirskole_week_availability` for de ansatte
søknadene. Eventuelle fritekstnotater eksporteres ikke. En tildeling bruker
`post_ref` for å peke på en vaktpost og `leader_ref` for å peke på den samme
`profiles.id` som den ansatte har i `staff`.

Når `source_schedule_published_at` er `null`, er planen ikke publisert for
lederne. Når feltet har et tidspunkt, kopieres det til lederappen og planen blir
synlig. Importerte vaktplaner styres videre i jobbplattformen.

## Funksjonsoppsett

`export-leirskole` autentiseres med `x-sync-secret`, og skal derfor være den
eneste funksjonen som får JWT-kontroll slått av i jobbplattformens
`supabase/config.toml`:

```toml
[functions.export-leirskole]
verify_jwt = false
```

Funksjonen skal bare godta `POST`, returnere `401` ved manglende eller feil
secret, og returnere en JSON-feil dersom en databaseforespørsel feiler. Den må
aldri skrive secret til respons eller logger.

## Verifisering

Etter deploy skal et kall uten secret gi `401`, ikke `404`:

```sh
curl -i -X POST \
  https://hiifcjletsoklagflnvn.supabase.co/functions/v1/export-leirskole
```

Et autorisert kall kan testes uten å skrive nøkkelen direkte i kommandoen:

```sh
read -s LEIRSKOLE_SYNC_SECRET
curl -i -X POST \
  -H "x-sync-secret: $LEIRSKOLE_SYNC_SECRET" \
  https://hiifcjletsoklagflnvn.supabase.co/functions/v1/export-leirskole
unset LEIRSKOLE_SYNC_SECRET
```
