# X-stil toast-design for alle meldinger

Målet er samme visuelle språk som X sine bekreftelser ("Removed from Bookmarks", "Post added to your Bookmarks"): en kompakt, mørk, svevende pille med kort tekst, avrundede hjørner, ingen kantlinje, myk skygge og en valgfri handlingsknapp som en egen fylt pille under teksten.

## Hva som endres

- Alle toasts (suksess, info, feil, advarsel) får samme mørke "pille"-stil.
- Kompakt: liten tekst, tett padding, maks bredde slik at pillen krymper rundt teksten i stedet for å fylle skjermen.
- Ingen fargede rammer eller status-ikoner — meldingen bæres av teksten. Feil får en diskret rød tekstfarge/aksent på tittelen så alvoret fortsatt leses.
- Handlingsknapp (som "Add to Folder") rendres som en full-bredde, avrundet, litt lysere knapp under teksten.
- Beskrivelsestekst i dempet grå under tittelen.
- Myk inn/ut-animasjon (fade + lett scale), litt kortere levetid på suksess.
- Fungerer i både lyst og mørkt tema: pillen er alltid mørk med lys tekst i mørkt tema, og i lyst tema en tilsvarende høy-kontrast mørk pille (som X på iOS).
- Beholder dagens plassering (nederst, midtstilt, over bunnmenyen og med safe-area). Ingen endring i hvor toasts dukker opp.
- StatusPopup for kritiske feil beholdes som i dag; det er egne modaler, ikke toasts.

## Teknisk

- `src/components/ui/sonner.tsx`: nye `toastOptions.classNames` for `toast`, `title`, `description`, `actionButton`, `cancelButton`, `error`/`success`-varianter, samt `unstyled`-tilnærming der det trengs for å fjerne standard border/bakgrunn.
- Nye semantiske tokens i `src/index.css` (f.eks. `--toast`, `--toast-foreground`, `--toast-action`) og mapping i `tailwind.config.ts`, slik at ingen hardkodede fargeklasser brukes.
- Ingen endringer i kallstedene — `toast.success()`/`toast.error()`/`statusPopup.*` fortsetter å virke uendret.
