# Øksnøen + — tøysepaywall som ser helt ekte ut

## Hvor ligger triggeren i dag

Funksjonen finnes allerede i to inngangspunkter (bygget forrige tur):

- `src/components/home/OffSeasonHome.tsx` — rund gullkrone-knapp «Øksnøen +» i snarveisraden (med rød prikk), åpner dialogen.
- `src/pages/More.tsx` — flis «Øksnøen +» i Off-season-seksjonen, åpner samme dialog.
- `src/components/offseason/OksnoenPlusDialog.tsx` — selve paywallen (enkel dialog med kronehode, pris 1 000 kr/mnd, 5 perks, toast-tull ved trykk).

Ingen database, ingen betaling, ingen ny rute. Alt er lokal state.

## Hva som mangler for at den skal se ekte ut

Dagens dialog er en vanlig shadcn-dialog og avslører seg som tøys med en gang. Planen er å bygge den om til noe som ser ut som en ordentlig Apple-/Spotify-aktig abonnementsside.

### 1. Fra dialog til fullskjerm-paywall
Erstatt dialogen med en fullskjerms «sheet» som glir opp (som App Store-abonnement):
- Mørk, dyp gradient-topp med subtil glød bak logo-merket.
- Stort `Øksnøen +`-merke med kronen i innfelt gullstil.
- Lukkeknapp som liten rund glass-X øverst i høyre hjørne.
- Trygg-sone-padding (`dvh` + safe-area) slik at det funker på iPhone.

### 2. Ekte abonnementsvalg
To planvalg med radio-utseende, akkurat som ekte paywalls:
- **Månedlig** — 1 000 kr/mnd (forhåndsvalgt).
- **Årlig** — 12 000 kr/år, merket «Spar 0 %» som vits, men grafisk helt ekte.
Valgt plan får ramme i primærfarge, hake og «MEST POPULÆR»-etikett.

### 3. Perk-liste som ser reell ut
Perks i rader med ikon + tittel + liten undertekst (ikke bare kulepunkter), f.eks.:
- Ubegrenset sol — «Tilgang til Øksnøen-sola året rundt»
- Gullsnus — «Eksklusiv snusboks i 24 karat»
- Prioritert klinekø — «Hopp foran i køen på klinelista»
- Egen fanfare — «Spilles automatisk når du går ned til brygga»
- Reklamefritt Lederhuset — «Ingen forstyrrelser i chatten»

### 4. Kjøpsflyt som «nesten» funker
Dette er det som gjør vitsen god — den skal føles som en ekte betaling:
1. Trykk «Abonner for 1 000 kr/mnd» → knappen går i lastemodus med spinner og teksten «Kontakter banken …».
2. Etter ~1,8 sekunder: rødt avvisningskort inne i paywallen — «Betaling avvist» med falsk feilkode (f.eks. `ERR_ØKS_402`) og en humoristisk grunn som varierer.
3. Grunnene roterer for hvert forsøk: «Kortet ble avvist av Bengt», «Øksnøen + er utsolgt», «Banken din tror du er på leir», «Prøv igjen sommeren 2027».
4. Etter 3 forsøk: liten «gratis prøveperiode»-knapp som bare gir en konfetti-toast «Du fikk 0 dager gratis 🎉» og lukker arket.

### 5. Ekte-detaljer (finpuss)
- Falske betalingsmerker (Visa / Mastercard / Vipps-lignende chips i grå toner).
- Liten grå «vilkår»-tekst nederst: fornyes automatisk, bindingstid hele livet, avbestilles ved å ro til land.
- «Gjenopprett kjøp»-lenke som gir toast «Fant ingen tidligere kjøp».
- Tøyse-disclaimer nederst i bittesmå bokstaver så det er tydelig at ingenting belastes.

### 6. Ekstra trigger (valgfritt, men morsomt)
Legg en liten lås-badge på 1–2 låste «premium»-flater for off-season-brukere (f.eks. et gråtonet «Statistikk»-kort på off-season-hjem) som åpner samme paywall ved trykk. Da føles det som en reell begrensning i appen.

## Teknisk

- Skriv om `src/components/offseason/OksnoenPlusDialog.tsx` til fullskjerm-variant (behold samme props `open` / `onOpenChange`, så eksisterende triggere i `OffSeasonHome.tsx` og `More.tsx` fortsetter å virke).
- All state lokalt i komponenten: valgt plan, `status: idle | processing | declined`, forsøksteller.
- Kun semantiske design-tokens (`primary`, `card`, `muted-foreground`, `destructive`) — ingen hardkodede farger; gull-effekten lages med en ny gradient-token i `index.css` + Tailwind-utility.
- Animasjoner med CSS/Tailwind (`animate-in`, spinner, shake på avvisning) — ingen nye pakker.
- Ingen databaseendringer, ingen edge functions, ingen ekte betaling.
