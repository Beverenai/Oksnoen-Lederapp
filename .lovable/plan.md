## Mål
Fjerne dobbel-funksjonen. Beholde kun «Ledere»-kortet i Innstillinger; fjerne «Lederaktivering».

## Endringer

`src/pages/admin/AdminSettings.tsx`
- Fjern `activation`-oppføringen fra `navItems`.
- Fjern `activation: 'Lederaktivering'` fra `sectionLabels`.
- Fjern `UserCog`-import hvis ubrukt.
- Slutt å sende `onLeaderUpdated`/`isSuperAdmin` videre dersom de blir ubrukte etter fjerningen (sjekk og rydd).

`src/components/admin/settings/AdminSettingsContent.tsx`
- Fjern `case 'activation'` og import av `LeaderActivationTab`.
- Behold `case 'leaders'` uendret.

`src/components/admin/LeaderActivationTab.tsx`
- Slett filen (ikke brukt andre steder etter fjerning).

Ingen DB- eller RLS-endringer.
