# Avreisedager og fleksible uker i Leirskole

## Slik blir det

**1. Ukeplanleggeren følger ukas faktiske lengde**
Rutenettet lager kolonner ut fra start- og sluttdato på uken, så en 3-dagers uke gir 3 kolonner og en 5-dagers uke gir 5 — uten annen oppsett. Teller for «X av Y ruter fylt ut» regnes ut fra samme antall dager, og avreisedager teller kun de øktene som faktisk finnes den dagen.

**2. Ny knapp «Avreisedag» per dag**
Øverst i hver dagkolonne får du en liten bryter som markerer dagen som avreisedag. Da endrer dagen seg:
- Dagkortet får eget utseende (dempet/avvikende farge + «Avreise»-merke) slik at det er tydelig forskjellig fra vanlige dager.
- Standardøktene (Økt 1–3) vises ikke som faste rader.
- I stedet får du en liste over **egne økter** for den dagen.

**3. Egne økter med navn og tid på avreisedager**
På en avreisedag kan du legge inn egne økter: navn (f.eks. «Rydding», «Bagasje ut», «Avreise buss») og start-/sluttid. Hver egen økt fungerer som en rute i ukeplanleggeren: du kan legge til aktiviteter fra aktivitetslista og sette farge, akkurat som i vanlige økter. Du kan redigere, endre rekkefølge og slette dem.

**4. Vaktplanen tar hensyn til avreisedager**
Vaktplan-generatoren lager ikke standardoppsettet (Frokost/Økt 1/Middag/Økt 2/Kvelds/Økt 3/Sanitas/Nattevakt) på avreisedager. Den bruker bare de øktene du selv har lagt inn for den dagen, og fordeler ledere på dem etter samme regler (maks 8 t/dag, 11 t hvile, kompetanse og rullering). Lederne ser dermed riktig plan for avreisedagen i sin egen ukevisning.

## Teknisk

**Database (én migrasjon)**
- Ny tabell `leirskole_week_days`: `week_id`, `date`, `day_type` ('normal' | 'departure'), tidsstempler, unik på (week_id, date). GRANT til `authenticated` + `service_role`, RLS: lesing for medlemmer av uken/leirskole-rollen, skriving for admin.
- `leirskole_week_plan_cells`: legg til `post_id uuid null references leirskole_posts(id) on delete cascade` og gjør `row_index` nullbar, slik at en rute kan knyttes til en egen økt i stedet for fast rad 1–3. Ny delvis unik indeks på (week_id, date, post_id).

**Frontend**
- `src/hooks/useLeirskole.ts`: hooks for å lese/sette dagtype (`useLeirskoleWeekDays`, `useSetLeirskoleDayType`), og utvidet lagring av plan-ruter med `post_id`. Gjenbruk eksisterende post-hooks for å opprette/endre egne økter.
- `src/components/admin/LeirskoleWeekPlanCard.tsx`: avreise-bryter per dag, avvikende dagstil, og for avreisedager rader basert på dagens egne økter med «Ny økt (navn + tid)»-dialog.
- `src/components/admin/LeirskolePostsCard.tsx`: vis «Avreise»-merke på dagen og skjul «legg inn standardoppsett»-forventningen der.

**Edge function**
- `supabase/functions/generate-leirskole-schedule/index.ts`: hent dagtyper for uken; hopp over standard-template og Middag-utfyllingen for avreisedager, og la bemanningstak/8-timersregler gjelde som før for de egne øktene.
