## Mål

1. Deltakere i walkie-kanalen vises som profilen sin: **fornavn + første bokstav av etternavn + profilbilde**.
2. Fikse at lyden ikke høres selv om man ser at noen snakker.

---

## 1) Profil-visning av deltakere

### Edge function (`livekit-token`)
- Hent også `profile_image_url` fra `leaders` ved oppslag.
- Bygg `displayName` = `"Fornavn E."` (første ord + første bokstav av siste ord + `.`).
- Legg `displayName` i JWT-claimet `name`, og pakk `{ avatar_url }` i `metadata`-claimet (LiveKit sender dette videre til alle deltakere som `participant.metadata`).

### Hook (`useWalkieTalkie.ts`)
- Utvid `WalkieParticipant`-typen med `avatarUrl?: string`.
- Les `p.metadata` (JSON.parse trygt) og hent `avatar_url`.
- Bruk `p.name` (allerede formatert fra serveren) som visningsnavn.

### UI (`WalkieTalkie.tsx`)
- I deltaker-listen: bytt ut tekstpunktet med `Avatar`-komponenten (`@/components/ui/avatar`) som viser bildet, fallback til initialer hvis bildet mangler.
- Vis navn ved siden av, med en grønn puls-ring rundt avataren når `isSpeaking` er true.

---

## 2) Ingen lyd selv om noen snakker

Årsak: LiveKit auto-attacher remote audio-tracks, men nettlesere (særlig iOS Safari og Chrome i PWA) krever en bruker-gest før lyd får spille. `Room.startAudio()` må kalles etter en tap, og status må observeres via `RoomEvent.AudioPlaybackStatusChanged`.

### Hook-endringer
- Lytt på `RoomEvent.AudioPlaybackStatusChanged` og eksponer `canPlayAudio: boolean` (`room.canPlaybackAudio`).
- Eksponer `startAudio()` som wrapper rundt `room.startAudio()`.
- Etter `connect()`: prøv `room.startAudio()` i en `try/catch` (vil ofte feile første gang uten gest, men det er ok).
- Sett `RoomOptions.audioOutput` og sørg for at `setMicrophoneEnabled(false)` ikke deaktiverer subscription til andres lyd (den gjør ikke det — kun lokal mikrofon).
- I `toggleMute`: behold dagens volum-toggle, men sett også volum via `participant.setVolume()` (riktigere API).

### UI-endringer
- Hvis `!canPlayAudio` etter tilkobling: vis en liten banner/knapp øverst: **"Trykk for å aktivere lyd"** som kaller `startAudio()`. Skjul banneret automatisk når lyden er aktivert.
- Også: når bruker først trykker PTT-knappen, kall `startAudio()` samtidig (gest finnes uansett).

---

## Tekniske detaljer

- Navn-formatter (server-side):
  ```ts
  const parts = leader.name.trim().split(/\s+/);
  const displayName = parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0]}.`
    : parts[0];
  ```
- Metadata i token:
  ```ts
  metadata: JSON.stringify({ avatar_url: leader.profile_image_url ?? null })
  ```
- Klient leser:
  ```ts
  const meta = p.metadata ? JSON.parse(p.metadata) : {};
  ```

Ingen DB-endringer, ingen nye dependencies — kun edge-funksjon, hook, og UI-komponent.
