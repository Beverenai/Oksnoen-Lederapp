# Skru av Klineliste, Slurker og Tinder for ledere

Alle tre funksjonene blir usynlige og utilgjengelige for vanlige ledere (både i sesong og off-season), men beholdes intakt for admin.

## Hva som endres for ledere

- **Klineliste**: fjernes fra «Mer»-menyen, fra desktop-sidemenyen og fra off-season-hjemskjermen. Ruten `/klineliste` blir admin-only.
- **Slurker**: fjernes som fliser/knapper fra off-season-hjemskjermen og hilsen-headeren. Ruten `/slurker` blir admin-only.
- **Tinder**: allerede deaktivert i navigasjonen; `/kline-tinder` peker i dag til klinelista og endres til å sende ledere til hjemskjermen i stedet.
- **Varsler**: klinelista- og slurker-varsler slutter å vises i varsellisten på hjem, og slutter å telle i app-badgen (rødt tall på ikonet) for ledere.
- **Off-season**: ledere utenom sesong får da Lederpass, Profil/Snus, Lederhuset, POV og Feedback — uten Klineliste og Slurker.

## Hva admin fortsatt har

- Admin-fanene «Slurker» og «Tinder» i innstillinger fortsetter uendret (utdeling av slurker, oversikt over likes/matcher).
- Admin kan fortsatt åpne `/klineliste` og `/slurker` direkte, og finner Klineliste under «Mer» som i dag (admin-only).
- Ingen data slettes: klineliste-koblinger, slurker, swipes og matcher blir liggende i basen.

## Teknisk

- `src/lib/limitedAccess.ts`: fjern `/klineliste` og `/slurker` fra `LIMITED_ACCESS_ROUTES`.
- `src/App.tsx`: pakk `/klineliste` og `/slurker` i en admin-sjekk (redirect til `/` for ikke-admin); `/kline-tinder` og `/liggeliste` redirecter til `/`.
- `src/pages/More.tsx`: Klineliste-oppføring kun `isAdmin` (fjern `hookupsEnabled`-grenen); ingen Slurker-oppføring i off-season-seksjonene.
- `src/components/layout/AppLayout.tsx`: fjern Klineliste fra desktop-nav for ikke-admin.
- `src/components/home/OffSeasonHome.tsx`: fjern «Gi slurker»- og «Klineliste»-flisene (behold POV og Snus, juster grid).
- `src/components/home/HomeNotifications.tsx` og `src/hooks/useAppBadge.ts`: ekskluder sips-/hookup-kilder for ikke-admin.
- Sider, hooks og admin-faner (`Klineliste.tsx`, `Slurker.tsx`, `useHookups`, `useSips`, `SipsAdminTab`, `TinderAdminTab`) beholdes slik de er.
