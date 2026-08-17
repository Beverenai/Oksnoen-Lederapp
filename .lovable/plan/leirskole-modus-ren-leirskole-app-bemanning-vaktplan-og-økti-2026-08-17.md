# Leirskole-modus: ren leirskole-app + bemanning, vaktplan og øktinfo

## Mål
Når appen står i Leirskole-modus skal den kun vise leirskole-ting. Admin skal ha ett sted for å styre hvem som jobber, generere vaktplanen, og legge inn øktinfo/beskjeder til de som jobber leirskole.

## 1. Rydd Leirskole-modus (kun leirskole-funksjoner)
- «Mer»-siden i leirskole-modus: fjern Lederpass-kortet (Lederpass hører til vanlig/off-season app) og behold kun Leirskole, Leirskole-chat, Min Profil, Logg ut, samt Leirskole-admin for admin.
- Desktop-menyen mangler i dag en leirskole-variant, så den viser off-season-menyen (Hjem, Lederhuset, Lederpass, Klineliste, Min Profil) — det er feilen du ser på bildet. Legger inn egen sidemeny for leirskole: Leirskole, Lederhuset (leirskole-kanal), Leirskole-admin (admin), Mer, Min Profil.
- Ruter utenfor leirskole (klineliste, lederpass, POV, tinder osv.) sender deg tilbake til leirskole-hjem når modus er leirskole.

## 2. Bemanning: hvem jobber denne uken
- Kortet «Leirskole-tilgang» (nytt) blir hovedstedet: søk blant alle ledere i appen, én bryter per leder som både setter dem på uken og gir dem leirskole-tilgang.
- Per leder på uken: rolle-etikett (f.eks. Kjøkken, Aktivitet), maks timer per dag (arves fra uken, kan overstyres), og timer brukt ut fra vaktplanen.
- Tydelig topp-status: antall på uken, hvem som mangler tilgang, og «Fiks tilgang»-knapp.

## 3. Vaktplan-generator hentet inn i Leirskole-admin
- Generatoren finnes allerede som backend-funksjon (8 t/dag, 11 t hvile). Den får nå et fullverdig grensesnitt i Leirskole-admin:
  - Poster/vaktmaler per uke: navn, dag, start/slutt, antall ledere, låst/ikke låst.
  - «Generer vaktplan» med valg om å beholde låste vakter, pluss visning av resultat (dekket/udekket, timer per leder, brudd på regler).
  - Ukeoversikt dag for dag der admin kan bytte leder på en vakt manuelt.
  - Publiser/avpubliser vaktplan med varsling til alle på uken (finnes, kobles til nytt UI).

## 4. Hybrid øktinfo til de som jobber leirskole
- Samme idé som «Denne økten skal du» i vanlig app, men for leirskoleuken:
  - Admin skriver øktinfo per uke: en beskjed/påminnelse øverst + punktliste med ting som gjelder økten/uken.
  - Kan sendes til alle på uken eller kun utvalgte ledere, med valgfri push-varsling.
  - Vises øverst på leirskole-hjem hos de det gjelder, med «lest»-markering.
- Oppgaver (finnes i dag) og øktinfo ligger side om side i admin, så alt admin trenger er på én side: Uke → Bemanning → Vaktplan → Øktinfo → Oppgaver.

## Teknisk
- `src/pages/More.tsx`: skjul `LederPassMini` når `accessMode === 'leirskole'`; leirskole-seksjonene beholdes.
- `src/components/layout/AppLayout.tsx`: egen desktop-sidebar-gren for `accessMode === 'leirskole'` (i dag faller den ned i `inactiveForUser`-grenen).
- `src/lib/limitedAccess.ts`: utvid `isLeirskoleRoute` og bruk den til redirect i leirskole-modus.
- `src/components/admin/LeirskoleAccessCard.tsx`: legg til rolle-etikett + maks timer per staff-rad og timer fra vaktplan.
- Ny `src/components/admin/LeirskolePostsCard.tsx`: CRUD på `leirskole_posts` (vaktmaler) + kall til `useGenerateLeirskoleSchedule`, visning av `leirskole_generator_runs`-statistikk.
- Ny `src/components/admin/LeirskoleSessionInfoCard.tsx` + visning i `src/pages/Leirskole.tsx`.
- Migrering: ny tabell `public.leirskole_session_info` (week_id, title, body, items text[], assign_all, assigned_leader_ids, created_by) med GRANT til authenticated/service_role, RLS: admin full tilgang, staff leser egne; samt `leirskole_session_info_reads` (info_id, leader_id) for lest-markering.
- Push gjenbruker `push-send` med `leader_ids` + `include_inactive: true`.
