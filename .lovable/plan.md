## Mål
Tillate at superadmin kan deaktiveres (skjules fra lederoversikten) uten å miste tilgang til appen.

## Funn
- `AuthContext` line 210 lar allerede superadmin logge inn selv om `is_active = false` — ingen endring trengs der.
- Lederoversikten (`useLeaderDashboardData`) filtrerer allerede bort `is_active === false`, så en deaktivert superadmin vil automatisk forsvinne fra grid og liste.
- Eneste blokker: `LeaderActivationTab.canToggle` returnerer `allowed: false` for alle med `role === 'superadmin'`.

## Endring
`src/components/admin/LeaderActivationTab.tsx`:
- I `canToggle`: tillat at superadmin slås av/på, men kun når innlogget bruker selv er superadmin.
  ```ts
  if (leader.role === 'superadmin' && !isSuperAdmin) {
    return { allowed: false, reason: 'Kun superadmin kan endre superadmin' };
  }
  ```
- I bekreftelses-dialogen for deaktivering, vis en kort info-tekst når raden er superadmin: «Superadmin beholder full tilgang, men skjules fra lederoversikten.»

Ingen DB-, RLS- eller andre kodeendringer nødvendig.
