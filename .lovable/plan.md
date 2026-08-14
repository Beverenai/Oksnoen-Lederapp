# Øksnøen POV — engangskamera for off-season

En pov.camera-inspirert funksjon: ledere tar bilder med et engangskamera i appen, bildene havner i en felles rull ("film") og er skjult til rullen "utvikles" — da avsløres alt samtidig for alle.

## Hvem
Kun off-season-tilgang (app i inaktiv modus eller ledere som ikke er aktive i perioden). Superadmin har alltid tilgang. Ny rute `/pov` legges i listen over tillatte off-season-ruter og som flis i Mer-menyen.

## Slik funker det

```text
Admin/superadmin lager en rull      Leder åpner /pov
  "Vinterfest 2026"                   -> ser hvor mange bilder han har igjen (10)
  status: open                        -> trykker utløser, blitz, ristelyd
  reveal_at: valgfri dato             -> bildet lagres, ingen forhåndsvisning
                                       -> teller går ned
Rullen utvikles (admin, eller når reveal_at passerer)
  -> alle bilder blir synlige i et rutenett for alle med tilgang
  -> trykk på bilde = fullskjerm, viser fotograf + tid, kan lastes ned
```

### Engangskamera-følelsen
- Fullskjerm kamera via `getUserMedia` (bakkamera default, bytt til front).
- Liten firkantet "viewfinder" med rammer, tellerhjul, blits-ikon og utløserknapp — ikke et vanlig kamera-UI.
- Ingen galleritilgang, ingen forhåndsvisning, ingen sletting: bildet er borte til utviklingen.
- Bildet får engangskamera-look: 4:3-crop, korn, lett vignett, varm fargetone, dato-stempel i hjørnet (kan slås av). Alt gjøres på canvas før opplasting, så filene er ferdig "utviklet".
- Blits: hvit fullskjerm-flash + haptikk ved utløsning.
- Tom for bilder = "Filmen er full" med countdown til utvikling.

### Etter utvikling
- Rutenett med alle bilder, sortert etter tid, med fotografens navn.
- Filter: "Alle" / "Mine".
- Reaksjoner (❤️) per bilde, teller vises.
- Tidligere ruller ligger i et arkiv nederst.

## Admin-styring
Egen seksjon i innstillinger: lag ny rull, sett navn, bilder per leder, reveal-dato, utvikle nå, lukk, og skjul/slett enkeltbilder.

## Teknisk

Nye tabeller (alle med RLS + GRANT):
- `pov_rolls` — `title`, `status` ('open' | 'developed' | 'closed'), `shots_per_leader`, `reveal_at`, `developed_at`, `season_year`, `created_by`. Alle innloggede ledere kan lese; kun admin kan skrive.
- `pov_photos` — `roll_id`, `leader_id`, `storage_path`, `taken_at`, `hidden`. Innsett: kun for egen `leader_id` på en åpen rull, og bare hvis leder har bilder igjen (validert i RPC). Lesing: alle bilder når rullen er `developed`, egne bilder aldri (holder overraskelsen), admin ser alt.
- `pov_photo_reactions` — `photo_id`, `leader_id` (unik sammen). Alle ledere kan lese/legge til/fjerne egen.

RPC-er (security definer):
- `pov_take_photo(_roll_id, _storage_path)` — sjekker åpen rull, teller opp mot `shots_per_leader`, setter inn raden.
- `pov_my_shots_left(_roll_id)` — returnerer antall bilder igjen.
- `pov_develop_roll(_roll_id)` — admin, setter status til `developed`.
- `pov_current_roll()` — aktiv rull + status + antall bilder totalt (uten å avsløre innholdet).

Storage: ny privat bucket `pov-photos`, path `<roll_id>/<leader_id>/<uuid>.jpg`. Signerte URL-er hentes først etter utvikling (samme mønster som `gjenglemt-images` i `useGjenglemt.ts`).

Frontend:
- `src/pages/Pov.tsx` — rute, kamera- eller galleri-visning avhengig av status.
- `src/components/pov/DisposableCamera.tsx` — kamerastrøm, utløser, blits, canvas-filter.
- `src/components/pov/PovGrid.tsx`, `PovPhotoViewer.tsx`.
- `src/hooks/usePov.ts` — React Query for rull, bilder, shots-left, reaksjoner + realtime.
- `src/components/admin/PovTab.tsx` — admin-styring.
- `/pov` legges til i `src/lib/limitedAccess.ts` og i Mer-menyen.

Mobil: 100dvh, safe-area-padding, portal for fullskjerm kamera — samme mønster som Øksnøen +-dialogen.
