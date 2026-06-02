## Endring i `ParticipantDetailDialog`

Erstatt dagens bred banner-crop med en sentrert rund avatar — trykk åpner hele bildet i fullskjerm uten beskjæring.

### Header-layout
- Fjern `h-32 sm:h-48`-banneret som beskjærer bildet.
- Vis en sentrert rund avatar (`h-28 w-28 sm:h-32 sm:w-32`, `rounded-full`, `object-cover`, `ring-2 ring-border`) over navnet.
- Initialer som fallback i samme sirkel.
- Kamera-knappen (last opp nytt bilde) flyttes som liten FAB nederst-høyre på selve avatar-sirkelen — samme funksjon som i dag.

### Tap for fullbilde
- Avataren blir trykkbar (kun når `image_url` finnes).
- Trykk åpner en `Dialog` med svart bakgrunn som viser hele bildet i `object-contain`, maks `90vh`/`95vw`, ingen beskjæring.
- Lukk via tap utenfor, Esc, eller en lukk-knapp øverst.
- Bruker eksisterende `Dialog`-komponenter; ingen nye avhengigheter.

### Det vi IKKE rør
- Opplastings-/komprimeringslogikken (`handleImageUpload`, `compressImage`).
- Resten av dialogen (Nurse-info, Styrkeprøve, Aktiviteter).
- Listevisningen av deltagere (kun detalj-dialogen endres).
- Ingen DB-endringer; ingen ny `object-position`-lagring.

### Filer
- `src/components/passport/ParticipantDetailDialog.tsx` — kun header-blokken (linje ~238–277) + ny lokal state `lightboxOpen` og en liten `Dialog` for fullbildet.
