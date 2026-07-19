## Mål
Ledere kan tildele ekstra poeng til deltakere for prestasjoner (1p for aktivitet, 2p for "ekstra"-variant). Kun synlig når Lag-funksjonen er på. Poeng logges per prestasjon og ruller opp til lagets totale poengsum.

## Database
Ny tabell `participant_bonus_points`:
- `participant_id` (fk participants)
- `period_id` (fk periods, default active)
- `team_id` (fk participant_teams, snapshot av lag ved tildeling)
- `activity_key` (text, f.eks. "tube", "klatring")
- `activity_label` (text)
- `variant` ('base' = 1p | 'extra' = 2p)
- `points` (int, 1 eller 2)
- `awarded_by` (fk leaders)
- `created_at`

RLS: leaders kan insert/select/delete egne rader i aktiv periode; admin kan alt. GRANT authenticated + service_role.

## Fast liste (hardkodet i `src/lib/bonusActivities.ts`)
| Aktivitet (1p) | Ekstra (2p) |
|---|---|
| Tube | I blinde |
| Vannski | En ski |
| Seiling | Til og fra strand uten hjelp |
| Skrikeren Svømming | 1, 2, 3 plass |
| Sjøslag | 1, 2, 3 plass |
| Triatlon | 1, 2, 3 plass |
| Klatring | Toppen av vanskelig vegg |
| Ræppis | Under 30 sekunder |
| Slottsholmen | 13 meter |
| Bruskasser | Over 20 kasser |
| Pil og bue | 8 eller bedre |
| Motorbåter | — |
| Riding | — |
| Tau-bane | — |

## UI
**ParticipantDetailDialog** (Passkontroll):
- Ny seksjon "Ekstra poeng" mellom Insjpoeng og aktiviteter
- Kun synlig når `teams_enabled = true` OG deltaker har `team_id`
- Header viser lagbadge + sum tildelte bonuspoeng for deltakeren i aktiv periode
- Grid med aktivitetsrader: navn til venstre, to knapper til høyre — `+1 Aktivitet` og `+2 Ekstra` (skjul Ekstra der den ikke finnes)
- Trykk = optimistisk insert, toast "Tildelt X poeng til {navn}"
- Under: liste over allerede tildelte poeng med sletteknapp (leder kan slette egne, admin kan slette alle)

## Poeng-oppsummering i TeamsTab
Utvid `TeamsTab` leaderboard slik at lagets totale poeng også inkluderer sum av `participant_bonus_points.points` for laget (filtrert på aktiv periode), i tillegg til eksisterende insjpoeng + bonus_points-justeringer.

## Hook
`useParticipantBonusPoints(participantId)` — henter rader for aktiv periode + `addBonus({activityKey, label, variant, points})` + `removeBonus(id)`, optimistiske oppdateringer, invalidate `participant-teams` og `bonus-points`.

## Filer
- Ny: `supabase/migrations/*` (tabell + RLS + GRANTs + indeks på period_id, team_id, participant_id)
- Ny: `src/lib/bonusActivities.ts`
- Ny: `src/hooks/useParticipantBonusPoints.ts`
- Endret: `src/components/passport/ParticipantDetailDialog.tsx` (seksjon skjules når `!teamsEnabled`)
- Endret: `src/components/stats/TeamsTab.tsx` (inkluder bonuspoeng i lag-sum)

## Avgrensninger
- Ingen admin-UI for å redigere listen — hardkodet per bekreftelse
- Ingen egen side/hjem-snarvei
- Insjpoeng-telleren beholdes uendret (separat fra bonuspoeng)
