
## Hva jeg ser i dokumentet vs. nåværende kode

Logikkdokumentet ditt er veldig presist. Jeg sammenlignet det mot `generate-shift-schedule/index.ts` slik den står nå. Det stemmer i grove trekk, men det er **flere konkrete avvik** som gjør at vaktplanen ikke matcher Excel-malen ennå.

### Avvik funnet (det jeg "mangler" / koden mangler)

**1. Frokost har for få folk**
- Doc: Frokostvakt (1 fra Økt 1+2-team) **+ hele UNDER18A** (minus evt. kjøkkenvakt).
- Kode: kun frokostvakt-personen blir pushet. UNDER18A er ikke med på frokost-vakten.

**2. Vekking ekskluderer morgenvakt**
- Doc: Hele UNDER18A inkl. morgenvakt-personen (han er allerede oppe).
- Kode: morgenvakt blir trukket ut av vekking-teamet.

**3. Kjøkkenvakt trekkes fra feil pool**
- Doc: 1 person fra **UNDER18B** (samme F-team som har bings den dagen).
- Kode: trekker fra `[...team1f, ...team2f]` — kan havne i UNDER18A.

**4. Personalmøte 1 har feil deltakere**
- Doc: Kun Økt 1+2-team + UNDER18A + UNDER18B. **Økt 3-teamet er IKKE med** (de hviler).
- Kode: alle 4 team pushes til `personalmoete`.

**5. Frokostvakt jobber også Økt 1 — men ekskluderes**
- Doc: Frokostvakt jobber Økt 1 sammen med teamet sitt (unntatt fra middag, ikke Økt 1).
- Kode: ekskluderer frokostvakt fra Økt 1.

**6. UNDER18B mangler på Økt 2**
- Doc: Økt 2 = Økt 1+2-team + UNDER18A*** + **UNDER18B** (bings er tilbake).
- Kode: pusher kun evening18 og morgenF til okt2. UNDER18B helt fraværende.

**7. Middag mangler UNDER18B**
- Doc: Middag = Frokostvakt(neste dag) + Økt 1+2-team* + **UNDER18B**.
- Kode: pusher kun morning18 + neste dags frokost. UNDER18B mangler.

**8. Legging er for liten gruppe**
- Doc: Legging = **hele Økt 3-team**** (minus nattevakt; de med Økt 1 neste dag slutter 23:45) + **Økt 1+2-team***** (de som IKKE jobbet Økt 1)**.
- Kode: bare 2 navngitte personer fra evening18 ("legging-paret"). Den store gruppen som faktisk legger barn er ikke med.

**9. "Neste-dag-Økt-1-slutter-23:45"-regelen mangler**
- Doc: Fotnote ****: Folk som har Økt 1 neste dag slutter legging 23:45.
- Kode: ingen markering eller tidshåndtering for dette.

**10. Bings ettermiddag — slug-mismatch**
- Doc bruker "bings_em". Koden pusher slug `'bings_ettermiddag'`. Må verifisere at `shift_types` har akkurat den slugen, ellers feiler `ST()`.

**11. Personalmøte 2 — slug-mismatch**
- Koden bruker `'personalmoete2'`. Må sikre at den finnes i `shift_types` (spec sier 15:45–16:00).

**12. Ankomst/avreise refererer til slugs som kanskje ikke finnes**
- Koden pusher `forberedelser, lunsj_mote, ankomst, middag_ankomst, informasjon, intro_moter, kiosk, legging_ankomst, nattevakt_ankomst, vekking_avreise, rydding, frokost_avreise, utdeling_pass, avreise, lunsj_mote_avreise, opprydning1, opprydning2`. Hvis disse ikke er seedet i `shift_types`, krasjer hele generatoren før normale dager skrives. Du sa ankomst/avreise kan fikses senere — da må vi enten **gjøre dem valgfrie** (skip hvis shift_type mangler) eller seede dem.

**13. Validering `kjokken_conflict` deklareres men brukes aldri** — kjøkkenvakt får ikke konflikt-sjekk mot morgenvakt/bings.

**14. Special_duties.duty_type-enum**
- Koden inserter `'sanitas'` og `'seilern_box'` som duty_type. Tabellen har ikke check-constraint, men interfacet i koden tillater bare `'morgenvakt' | 'bingsvakt' | 'nattevakt' | 'frokostvakt' | 'kjokkenvakt'`. Type-løgn — vil kompilere, men inkonsistent.

**15. Frokostvakt-rotasjon per team**
- Doc: separat rotasjon per team (`frokostvakt_rot_t1` for Dag A, `frokostvakt_rot_t2` for Dag B).
- Kode: bruker generell `pickFairest`. Funker fordi team-poolen filtrerer, men bør verifiseres at samme person ikke får frokost flere ganger på rad.

---

### Foreslått fix-plan (kort)

Hvis du vil at jeg implementerer dette i neste runde, foreslår jeg å gjøre alt i ett pass i `generate-shift-schedule/index.ts`:

1. **Frokost**: legg til `pushTeam(d, dt, 'frokost', p.morgenF, [p.morgen?, kjokken?], null)` i tillegg til `pushLeader` for frokostvakt.
2. **Vekking**: fjern `[p.morgen]`-eksklusjonen.
3. **Kjøkkenvakt**: bytt pool til `grouped[p.bingsF]` (UNDER18B kun).
4. **Personalmøte 1**: pushTeam for `morning18, morgenF, bingsF` — IKKE `evening18`.
5. **Frokostvakt på Økt 1**: fjern eksklusjon — frokostvakt skal være med i okt1.
6. **Økt 2**: legg til `pushTeam(d, dt, 'okt2', p.bingsF, [p.kjokken?], null)`.
7. **Middag**: legg til `pushTeam(d, dt, 'middag', p.bingsF, [...p.bings, p.kjokken?], null)`.
8. **Legging-store-gruppe**: pushTeam evening18 (uten nattevakt) + pushTeam morning18 ekskludert de som var på Økt 1 = ALLE i morning18 minus seg selv → praktisk talt ingen, så her må vi tenke. Egentlig: morning18-folk er PÅ Økt 1, så `*****` betyr "ingen fra morning18 på legging" → det er bare evening18. **Korrigert**: legging = evening18 minus nattevakt minus de som har Økt 1 NESTE dag (de slutter 23:45). Dette er faktisk hva regelen sier — så ***** -regelen om "ikke jobbet Økt 1 i dag" treffer kun spesielle dager (f.eks. når noen frokostvakter krysser team). Verifiser.
9. **Slugs**: lag en `seedShiftTypes`-funksjon som upserter ALLE slugs koden bruker (ikke bare seilern + sanitas). Så slipper vi krasj.
10. **Kjøkken-konflikt-warning**: aktivér.

### Spørsmål før jeg bygger

1. **Legging — store gruppen**: Skal hele evening18-teamet stå på legging-vakten (de som faktisk legger barn), og er `legging`-paret (2 navngitte) en separat "ansvarlig"-rolle? Eller er det virkelig bare 2 navngitte personer fra hele teamet? Doc linje 60 sier "min 8 ledere" på legging.
2. **Ankomst/avreise**: Skal jeg gjøre dem **no-op** (hopp over hvis shift_type mangler) til vi får på plass logikken, eller skal jeg seede slugene med rimelige defaults nå?
3. **`personalmoete` vs `personalmoete2`**: Er det to separate shift_type-rader (én pr. PM), eller én shift_type som brukes to ganger pr. dag?

Når du svarer på disse 3, skriver jeg en konkret implementasjonsplan og kjører den.
