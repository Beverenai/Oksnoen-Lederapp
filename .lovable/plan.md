## Fjern walkie-talkie funksjonen

### Frontend
- Slett `src/pages/WalkieTalkie.tsx` og `src/hooks/useWalkieTalkie.ts`.
- I `src/App.tsx`: fjern lazy import av `WalkieTalkie` og `/walkie`-ruten.
- I `src/components/layout/AppLayout.tsx`: fjern Walkie-lenken (Radio-ikonet) fra bunnnavigasjonen.

### Backend
- Slett edge function `supabase/functions/livekit-token/` (kode + deploy-fjerning via `supabase--delete_edge_functions`).
- Ny migrasjon som dropper alt walkie-relatert i DB:
  - DROP TRIGGER/FUNCTION for `sync_walkie_member_*` og evt. resterende walkie-funksjoner.
  - DROP TABLE `public.walkie_channel_members`, `public.walkie_channels` (CASCADE).

### Avhengigheter
- Fjern `livekit-client` fra `package.json` (bun remove).

### Secrets (valgfritt)
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` kan stå – de er ufarlige uten funksjonen. Jeg lar dem være, du kan slette dem manuelt i Cloud-innstillinger om du vil.

Bekreft, så fjerner jeg alt.