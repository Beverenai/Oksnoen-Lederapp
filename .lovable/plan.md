
## Fiks: autentisering må bli deterministisk, ikke “best effort”

### Hva som faktisk er galt
Dette er ikke primært et loading-problem. Rotfeilen er at appen av og til ikke får koblet den aktive auth-sesjonen til riktig rad i `leaders`, og da “vet” resten av appen ikke hvem brukeren er.

Jeg vet hva hovedproblemet er:
1. `src/contexts/AuthContext.tsx` bruker `async` direkte inne i `supabase.auth.onAuthStateChange(...)`
2. Der inne kalles nye Supabase-forespørsler (`loadLeaderFromSession`, RPC for roller, ev. signOut)
3. Dette matcher en kjent deadlock/race-condition i Supabase-klienten, som kan gjøre at neste kall henger eller at auth-state blir inkonsistent
4. I tillegg ignoreres `INITIAL_SESSION`, og auth-init + auth-listener konkurrerer delvis med hverandre
5. Flere sider antar at bruker/roller allerede er klare, og fyrer egne queries for tidlig

RLS ser ikke ut som hovedårsaken her. Problemet ligger i hvordan klienten gjenoppretter og bruker sesjonen.

### Endringer
**1. Bygg om `AuthContext.tsx` til en trygg auth-flyt**
- Fjern `await`-basert Supabase-logikk direkte fra `onAuthStateChange`
- La listeneren kun oppdatere enkel lokal auth-state synkront
- Flytt lasting av `leader` + roller til en separat effekt/funksjon som trigges etter at session/user-id er satt
- Håndter `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED` og `SIGNED_OUT` konsekvent

**2. Skill mellom tre ting som i dag blandes sammen**
- auth-sesjon finnes / finnes ikke
- lederprofil er lastet / ikke lastet ennå
- roller er lastet / ikke lastet ennå

Det betyr at contexten bør få en tydelig “ready”-modell, f.eks.:
```text
booting -> session restored -> leader resolved -> roles resolved -> app ready
```

**3. Gjør “hvem er brukeren?” robust**
- Når session finnes, last `leaders` via `auth_user_id`
- Hvis leder ikke finnes med én gang, prøv kort retry før brukeren logges ut
- Ikke kall sesjonen “stale” for tidlig
- Nullstill `viewAsLeader` ved logout eller når auth-bruker endres

**4. Ikke la sider hente data før auth faktisk er klar**
- `Home.tsx`, `Profile.tsx` og `Admin.tsx` skal vente på ferdig auth-resolusjon før de kjører egne queries
- `Admin.tsx` skal ikke kjøre `loadData()` før admin-status er ferdig avklart
- Eksisterende timeout/retry kan beholdes, men som fallback — ikke som hovedløsning

**5. Forbedre login-flyten**
- Etter `phone-login` og `setSession`, bruk samme sentrale auth-sync som resten av appen
- Unngå parallell “manuell” profilopplasting + auth-listener som prøver å gjøre samme jobb samtidig
- Bruk én sannhetskilde for innlogget leder

**6. Legg inn tydeligere auth-diagnostikk**
- Logg stegvis:
  - session restored
  - auth user id funnet
  - leader funnet / ikke funnet
  - roller lastet
  - auth ready
- Dette gjør at vi kan se nøyaktig hvor det stopper hvis det skjer igjen

### Filer som bør endres
- `src/contexts/AuthContext.tsx` — hovedfiks
- `src/App.tsx` — ev. justere route-gating mot ny auth-ready-state
- `src/pages/admin/Admin.tsx` — ikke fetch før auth/rolle er klar
- `src/pages/Home.tsx` — behold datafetch, men gate på klar auth
- `src/pages/Profile.tsx` — behold datafetch, men gate på klar auth

### Teknisk retning
```text
Før:
onAuthStateChange(async () => {
  await supabase query
  await rpc
  await signOut
})
=> race/deadlock / feil brukeroppløsning

Etter:
onAuthStateChange(() => {
  set raw auth state only
})

useEffect([sessionUserId]) => {
  resolve leader
  resolve roles
  mark auth ready
}
```

### Resultat
- Appen skjønner konsekvent hvem brukeren er
- Refresh/PWA-reopen mister ikke profilkoblingen tilfeldig
- Admin/status/rolle blir riktig etter sesjonsgjenoppretting
- Sider som Home, Profil og Admin starter ikke for tidlig
- “Prøv igjen” blir backup, ikke selve autentiseringsstrategien
