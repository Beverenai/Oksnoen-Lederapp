# AI-eldre bilder av deltakerne

Alle deltakerbilder kan få en AI-generert «eldre versjon» av seg selv. Admin starter jobben i Admin, og i passkontrollen kan man trykke på bildet for å flippe mellom nå-bildet og eldre-bildet.

## Slik blir det for brukeren

1. **Admin → nytt kort «AI: Eldre versjon av deltakerbilder»**
   - Knapp «Generer manglende» (kun de som mangler) og «Regenerer alle».
   - Fremdriftslinje med antall generert / igjen / feilet, samme mønster som thumbnails-kortet.
   - Kjører i puljer (5 om gangen) siden bildegenerering tar tid.

2. **Deltakerkort i passkontroll**
   - Trykk på bildet → 3D-flip til eldre-utgaven, med liten «+40 år»-merkelapp og tekst «Trykk for å bytte tilbake».
   - Har deltakeren ikke eldre-bilde ennå, oppfører bildet seg som i dag (åpner lightbox).
   - Eldre-bildet vises kun i deltakerkortet — ikke i lister, ikke på passet.

## Teknisk

**Database**
- Ny kolonne `participants.image_aged_url text` (nullable). Ingen RLS-endringer; leses av samme roller som `image_url`.
- Bildene lagres i eksisterende `participant-images`-bucket som `<id>_aged.jpg`.

**Edge function `generate-participant-aged`**
- Henter deltakere med `image_url` (og `image_aged_url is null` når `force` ikke er satt), i puljer med `offset`/`batch_size`.
- For hver: last ned bildet → kall Lovable AI Gateway `/v1/images/generations` med `google/gemini-3-pro-image` (bilderedigering, ikke-strømmende siden vi bare skal lagre resultatet), prompt på linje med: samme person, samme positur/bakgrunn, aldret ca. 40 år, realistisk portrett, ingen andre endringer.
- Laster opp resultatet til storage, skriver `image_aged_url` med cache-buster, returnerer `{ processed, failed, remaining, details }`.
- Ingen egen timeout rundt gateway-kallet (generering kan ta lang tid). Bruker `LOVABLE_API_KEY`.

**Frontend**
- `src/components/admin/AgedPhotosGeneratorCard.tsx` (kopierer flyten fra `ThumbnailsGeneratorCard`), lagt inn samme sted i Admin.
- `ParticipantDetailDialog.tsx`: lokal `flipped`-state på avataren, CSS-flip, faller tilbake til dagens lightbox når `image_aged_url` mangler.

## Kostnad og gjennomkjøring
Hvert bilde er ett AI-bildekall, så en full runde på ~90 deltakere = ~90 kall mot AI-kreditter. Derfor er «Generer manglende» standard, og «Regenerer alle» ligger som sekundærknapp.

## Utenfor omfang
Ingen automatisk generering ved import, ingen yngre/andre stiler, ingen visning i lister eller eksport.
