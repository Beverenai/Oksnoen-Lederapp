## Utvid "Lim inn fra Sheet" til å støtte alle kolonner

Utvider `PasteLeaderContentSheet` slik at hele arket kan limes inn — inkludert leder-metadata (Tlf, Hytte, Ministerpost, Team) i tillegg til innholdsfeltene som finnes i dag.

### Kolonnemapping (case-insensitive, godtar varianter)

| Kolonne i ark | Felt i database | Tabell |
|---|---|---|
| `Tlf` / `Telefon` / `Phone` | `phone` | `leaders` |
| `Navn` / `Name` | `name` (matching) | `leaders` |
| `Aktivitet` / `Activity` | `current_activity` | `leader_content` |
| `Notater` / `Notes` | `personal_notes` | `leader_content` |
| `Til deg` / `Til lederen` | `personal_message` | `leader_content` |
| `OBS!` / `OBS` / `Viktig` | `obs_message` | `leader_content` |
| `Ekstra #1` / `Ekstra 1` | `extra_1` | `leader_content` |
| `Ekstra #2` … `#5` | `extra_2` … `extra_5` | `leader_content` |
| `Hytte` / `Cabin` | `cabin` | `leaders` |
| `Ansvar` | `extra_activity` | `leader_content` |
| `Ministerpost` | `ministerpost` | `leaders` |
| `Team` | `team` | `leaders` |

### Matching av leder

- Primært på `Tlf` (normalisert: bare siffer, siste 8) når kolonnen finnes — mest robust mot stavefeil i navn.
- Fallback til normalisert navn-match hvis Tlf mangler eller ikke treffer.
- Hvis verken Tlf eller Navn matcher → vises som "Ikke matchet" i forhåndsvisning og hoppes over.

### Lagring

- To parallelle upserts pr. matched leder:
  - `leaders` (kun feltene som finnes i pasten: phone, cabin, ministerpost, team)
  - `leader_content` (current_activity, extra_activity, personal_notes, personal_message, obs_message, extra_1..5) + `last_synced_at = now()`
- Tomme celler ignoreres (overskriver ikke eksisterende verdier) — som i dag.

### Forhåndsvisning

Utvides til å vise alle felter som vil endres pr. leder, gruppert pr. tabell:
- 📇 Leder-info: phone, cabin, ministerpost, team
- 📋 Innhold: aktivitet, notater, til deg, OBS, ekstra-felter, ansvar

### Filer som endres

- `src/components/admin/PasteLeaderContentSheet.tsx` — utvidet kolonnemapping, leder-tabell-upsert, telefon-matching, oppdatert preview-UI.

Ingen DB-migrasjoner. Ingen edge functions. Ingen n8n.
