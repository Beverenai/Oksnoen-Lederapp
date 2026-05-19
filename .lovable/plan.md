## 1. Ledere-listen — bedre hierarki + fjerne grønn aktivitets-ikon

**Fil:** `src/pages/Leaders.tsx` (linje 503–585)

Endre kortet slik at det er tydeligere visuelt hierarki — navn er hovedinfo, aktivitet er nest viktigst, så metadata (post + badges) trer i bakgrunnen.

- **Navn (linje 521–523):** behold `font-semibold`, øk til `text-base`/`text-lg` (litt større), beholder farge.
- **Ministerpost (linje 525–529):** flytt opp som liten label-tekst (`text-[11px] uppercase tracking-wide text-muted-foreground`) over navnet — fungerer som "rolle-etikett" likt iOS subhead-mønster. Alternativt under navnet, men mindre og lysere.
- **Aktivitet (linje 531–539):** Fjern `<Activity>`-ikonet. Vis bare teksten i `text-foreground font-bold text-base` (svart/foreground, ikke grønn primary). Beholder `mt-1.5` og `truncate`.
- **Badges (linje 542–561):** krymp til `text-[10px]` (allerede) og bruk muted-stil — disse skal være sekundære.
- **Telefonknapp:** uendret (grønn rund).

Resultat: Navn dominerer, aktivitet leses tydelig i fet svart uten ikon-støy, badges/post er rolig metadata.

## 2. Passkontroll — større "Aktivitet"-knapp som åpner egen side

**Filer:**
- `src/pages/Passport.tsx` (linje 367–399, 402–409)
- `src/App.tsx` (rute-registrering)
- Ny fil: `src/pages/PassportActivity.tsx`

**Endringer:**
- Bytt `size="sm"` → `size="default"` (eller `lg`) på Aktivitet-knappen, gjør den til primær variant så den skiller seg ut. Litt mer padding, tydeligere ikon.
- Fjern `showBulkRegistration` toggle-state + inline `<BulkActivityRegistration>`-blokk. `onClick` navigerer i stedet til ny rute, f.eks. `/passkontor/aktivitet`.
- Ny side `PassportActivity.tsx`: full-side wrapper som henter `participants` (gjenbruk samme query/hook som Passport bruker) og rendrer eksisterende `<BulkActivityRegistration>` på hel skjerm med tilbake-knapp som navigerer til `/passkontor`. `onComplete` → invalider query + navigate tilbake.
- Registrer ruten i `src/App.tsx` ved siden av eksisterende `/passport`/`/passkontor`-rute (samme RoleGuard som Passport).

## Ikke endret
- Backend, RLS, sync, datahenting.
- BulkActivityRegistration-komponenten internt (kun ny wrapper-side).
- Andre handlinger på Passport (Viktig Info, Min hytte).