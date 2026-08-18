# Visningsvelger: bytt mellom app-modusene

August (superadmin) og Sophie (admin) er begge markert som inaktive i databasen, så appen viser dem kun off-season-versjonen i dag. Sophie har heller ikke leirskole-rollen. Løsningen er en enkel bryter som lar dem velge hvilken app de vil se — uten å endre om de er aktive.

## Hva som lages

En "Vis app som"-velger med tre valg:

- **Full app** — hele lederappen (hjem, passkontroll, deltakere, admin osv.)
- **Off-season** — den inaktive/sommer-versjonen med Lederpass, Klineliste, POV, Slurker
- **Leirskole** — leirskole-siden, leirskole-kanal i Lederhuset og oppgaver

Valget:
- vises som en knapp/rad øverst under **Mer**, og som en snarvei i topplinjen når man er i en annen modus enn normalt
- huskes på enheten (så man ikke må velge på nytt hver gang)
- er kun synlig for admin/superadmin — vanlige ledere ser ingen endring
- har alltid "Automatisk" som standard, som oppfører seg helt som i dag

## Tilgang

- Sophie får leirskole-tilgang i tillegg til admin, slik at Leirskole-valget og leirskole-kanalen faktisk er tilgjengelig for henne.
- August har superadmin og trenger ingen rolleendring.

## Teknisk

- Ny `src/hooks/useViewMode.ts`: `'auto' | 'full' | 'offseason' | 'leirskole'` lagret i `localStorage`, med kontekst-lignende hook slik at alle sider leser samme verdi.
- `AuthContext` utvides med avledede flagg: `effectiveLimitedAccess` og `effectiveLeirskoleView`, som kombinerer dagens `isLimitedAccess`/`isLeirskole` med overstyringen. Kun admin/superadmin får overstyre.
- Oppdater gate-logikken som i dag bruker `isLimitedAccess || (appMode === 'inactive' && !isSuperAdmin)`:
  `src/App.tsx` (rute-gate), `src/components/layout/AppLayout.tsx` (nav), `src/pages/Home.tsx` (off-season hjem), `src/pages/More.tsx` (menyfiltrering), samt `Chat.tsx` for leirskole-kanalen.
- Ny komponent `src/components/layout/ViewModeSwitcher.tsx` (segmented control i glass-stil, i tråd med resten av appen).
- Migrasjon: legg til `leirskole`-rollen for Sophie Simonsen i `user_roles`.
