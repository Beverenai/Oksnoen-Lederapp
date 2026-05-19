## Walkie-Talkie for ledere (LiveKit Cloud)

Push-to-talk walkie i Øksnøen LederApp, fungerer i PWA + Capacitor iOS. Auto-kanaler per hytte/team + "Alle ledere". Admin/sjef ser alle kanaler.

## Forutsetninger (må avklares før build)

1. **LiveKit Cloud-konto:** trenger `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` (wss://…). Disse legges som backend-secrets (jeg ber om dem ved start av implementasjon).
2. **iOS mikrofon-permission:** du sa du fikser `NSMicrophoneUsageDescription` i Info.plist lokalt — OK.

## Database

Ny migrasjon. NB: prosjektet bruker `leaders.id` (ikke `auth.uid()`) — jeg justerer policies til å bruke `current_leader_id()` og `is_admin()`, som matcher resten av appen (din skisse vil feile fordi `auth.uid()` ≠ `leaders.id`).

```sql
create table walkie_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel_type text not null check (channel_type in ('cabin','team','all','custom')),
  cabin_id uuid references cabins(id) on delete cascade,
  team text,
  created_at timestamptz default now()
);

create table walkie_channel_members (
  channel_id uuid references walkie_channels(id) on delete cascade,
  leader_id uuid references leaders(id) on delete cascade,
  can_speak boolean default true,
  primary key (channel_id, leader_id)
);

-- RLS
alter table walkie_channels enable row level security;
alter table walkie_channel_members enable row level security;

create policy "channels_select" on walkie_channels for select to authenticated using (
  is_admin() OR is_nurse()
  OR id in (select channel_id from walkie_channel_members where leader_id = current_leader_id())
);
create policy "channels_admin_write" on walkie_channels for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "members_select" on walkie_channel_members for select to authenticated using (
  is_admin() OR is_nurse() OR leader_id = current_leader_id()
);
create policy "members_admin_write" on walkie_channel_members for all to authenticated
  using (is_admin()) with check (is_admin());
```

**Seed + auto-vedlikehold:**
- Opprett én "Alle ledere"-kanal (`channel_type='all'`) med alle aktive ledere som medlemmer.
- Én kanal per eksisterende `cabins`-rad; medlemmer = ledere i `leader_cabins`.
- Triggere: `cabins INSERT` → auto-opprett kanal. `leader_cabins INSERT/DELETE` → sync medlemskap. `leaders INSERT` → legg til i "Alle ledere".

## Edge Function: `livekit-token`

`supabase/functions/livekit-token/index.ts`
- Input: `{ channel_id }`
- Validerer JWT, henter `current_leader_id`, sjekker medlemskap (eller `is_admin/is_nurse`).
- Genererer LiveKit JWT med room `channel_<id>`, identity = leader.id, name = leader.name. Bruker `npm:livekit-server-sdk`.
- Returnerer `{ token, url }`. CORS-headers inkludert.
- Secrets fra env: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.

## Frontend

**Avhengighet:** `livekit-client` (ren SDK, ingen `@livekit/components-react`).

**Hook `src/hooks/useWalkieTalkie.ts`:**
- `connect(channelId)` → fetch token via `supabase.functions.invoke('livekit-token')`, `new Room()`, `room.connect(url, token)`, publiser lokal mic-track men start `muted/disabled`.
- `startTalking()` / `stopTalking()` → toggle `localParticipant.setMicrophoneEnabled(true/false)` + haptisk feedback via `hapticImpact`.
- Reaktiv state: `participants`, `activeSpeakers`, `connectionState`, `isTalking`.
- `disconnect()` ved unmount + ved `visibilitychange → hidden` (spar batteri).

**Side `src/pages/WalkieTalkie.tsx` på `/walkie`:**
- Kanal-liste (henter fra `walkie_channels` + medlemskap). Ikon 📢 for "all", 🛖 for "cabin", 👥 for "team". Live deltagerantall fra LiveKit (kun for valgt kanal — full presence-per-kanal krever ekstra arbeid, vises som "Trykk for å se").
- Inne i kanal: deltagerliste m/ avatar + grønn mic-ring når `activeSpeakers` inneholder dem. Stor sirkulær PTT-knapp (`pointerdown/up` + `touchstart/end` + cancel-handlers, rød `bg-destructive` mens trykket). Mute-knapp (toggler remote audio). "Forlat kanal".
- Mikrofon-permission-prompt med tydelig "Tillat mikrofon"-knapp ved `NotAllowedError`.
- Offline-banner via eksisterende `useOfflineStatus`, automatisk reconnect via LiveKit's innebygde retry.

**Navigasjon:**
- Route i `App.tsx` (lazy): `/walkie`.
- Ikon i hamburgermeny (`AppLayout`) — "Walkie" med `Radio`-ikon fra lucide.
- FAB-snarvei på Hjem.

## Design

Tailwind semantic tokens: `bg-primary` for aktiv-state, `bg-destructive` mens man snakker, glassmorphism kort som resten av appen. Haptisk feedback på start/stop talk.

## Eksplisitt ikke med
- Info.plist-endringer (du gjør lokalt)
- Apple PushToTalk framework
- Background audio / push-to-wake

## Spørsmål før jeg starter
1. Skal **nurse** også ha tilgang til alle kanaler (din SQL inkluderte det)? Bekrefter.
2. **Team-kanaler:** skal det opprettes én pr unik `leaders.team`-verdi, eller pr `leader_teams` (periode-basert)? Sistnevnte er mer korrekt med deres modell.
3. OK at jeg ber om LiveKit-secrets nå, eller vil du sette opp kontoen først?
