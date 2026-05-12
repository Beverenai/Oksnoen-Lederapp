# Plan for å fikse n8n-sync til lederne

## Det jeg allerede har bekreftet
- Import-webhooken treffer backend og kjører ferdig.
- `sync-leaders-import` logger viser nylig: `0 created, 32 updated`.
- Data ligger faktisk i databasen etter sync.
- Eksempel: lederen `August Raae Frisvold` har oppdatert `current_activity` og `obs_message` i databasen.
- Webhook-URLene er lagret:
  - import: `sync-leaders`
  - eksport: `leader-sync`
- Eksport tilbake til n8n ser ikke ut til å kjøre nå, fordi `trigger-export` ikke har ferske kjøringer i loggene.

## Sannsynlig problem
Importen fra n8n ser ut til å virke, men ledervisningen henter enten:
- feil felter,
- stale/cachet data,
- eller oppdaterer ikke UI-et etter sync.

I tillegg er eksport-retningen en egen feil: backend-funksjonen for eksport blir ikke trigget i praksis.

## Hva jeg vil gjøre
1. Kartlegge nøyaktig hvilke felter som syncer inn fra n8n, og hvilke av dem leder-appens skjermer faktisk viser.
2. Spore dataflyten på leder-sidene (`Home`, `Leaders`, relevante hooks og realtime/query-cache) for å finne hvorfor oppdatert innhold ikke blir synlig.
3. Reprodusere med en konkret leder i preview og verifisere om problemet er cache, realtime, filterlogikk eller feil kobling mellom `leader` og `leader_content`.
4. Sjekke eksportflyten separat og koble den til faktisk trigger, siden `trigger-export` ikke ser ut til å bli kalt nå.
5. Foreslå og implementere en målrettet fix etter hva funnet viser.

## Teknisk fokus
- `supabase/functions/sync-leaders-import/index.ts`
- `src/pages/Home.tsx`
- `src/pages/Leaders.tsx`
- eventuelle hooks som leser `leader_content`
- `supabase/functions/trigger-export/index.ts`
- admin-sidene som starter sync/eksport

## Forventet resultat
- Nye n8n-data blir synlige for riktig leder i appen.
- Vi vet om problemet ligger i import, visning, caching eller leader-kobling.
- Eksport tilbake til n8n kan testes og bekreftes separat.