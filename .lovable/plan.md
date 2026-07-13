## Mål
Kun ledere med `is_active = true` skal motta push-varsler. Inaktive ledere beholder sine push-abonnement i databasen, men hoppes over ved sending — så de får varsler automatisk igjen når de settes aktive.

## Endringer

### 1. `supabase/functions/push-send/index.ts`
Legg til et filter-steg like før varslene sendes:
- Etter at listen `subscriptions` er hentet, slå opp `leaders.is_active` for alle unike `leader_id`-er i batchen.
- Filtrer bort abonnement der lederen er inaktiv (eller ikke finnes).
- Logg hvor mange som ble hoppet over (`inactiveSkipped`) og returner tallet i responsen.
- Gjelder både `single_leader_id`-grenen og hoved-grenen (broadcast / target_activity / target_unread_with_content / leader_ids).

### 2. `supabase/functions/push-admin-alert/index.ts`
Samme filter-logikk: hopp over abonnement til inaktive ledere før sending.

### 3. Ingen database-endringer
- Ingen ny tabell, ingen sletting av eksisterende abonnement.
- `push_subscribe` beholdes som i dag — inaktive ledere kan fortsatt registrere/oppdatere abonnement, men får bare varsler når de er aktive.

## Effekt for brukeren
- Admin ser ingen forskjell i UI — mottakertellingen på "Send til alle" viser fortsatt totalt antall abonnement, men faktisk `sent`-antall vil ekskludere inaktive.
- Så snart en leder settes `is_active = true` igjen, mottar de varsler uten å måtte aktivere på nytt.

## Teknisk notat
Bruker én ekstra spørring per push-kall: `select id from leaders where id in (...) and is_active = true`, deretter in-memory filtrering. Ubetydelig ytelseskost.
