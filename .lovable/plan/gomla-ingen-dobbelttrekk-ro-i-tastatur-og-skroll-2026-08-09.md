# Gomla: ingen dobbelttrekk, ro i tastatur og skroll

Tre feil skal fikses: dobbelttrekk av penger, tastatur som spretter opp når man trykker Registrer, og at søk hopper til toppen av siden.

## 1. Aldri dobbelttrekk

- Registrer-knappen låses med en egen lås som settes med én gang du trykker (før noe nettverk skjer), i tillegg til dagens ventestatus. Andre trykk gjør ingenting, også når appen henger.
- Hvert kjøp får en unik nøkkel som sendes med til serveren. Sender appen samme kjøp to ganger (dobbelttrykk, treg linje, retry), lagrer serveren det kun én gang og returnerer det samme salget. Dette er den egentlige sikringen mot å bli trukket to ganger.
- Knappen viser tydelig "Registrerer…" mens det pågår, og hele kurvlinjen blir inaktiv.
- Hvis kjøpet feiler, kommer kurven og deltageren tilbake som i dag, og låsen åpnes igjen.

## 2. Tastaturet skal ikke sprette opp

- Når du trykker Registrer uten valgt deltager, åpnes deltagervelgeren uten at søkefeltet får fokus — listen vises, og tastaturet kommer først når du selv trykker i søkefeltet.
- Samme regel i kvitteringssøket: ingen autofokus ved åpning.
- Vareøksfeltet i toppen beholder fokus når du selv åpner det (det er villet), men lukkes uten å trigge nytt fokus.

## 3. Søk skal ikke hoppe til toppen

- Kategorichipsene forsvinner i dag når du skriver i søket, så innholdet flytter seg og siden hopper. Chipsraden blir stående (nedtonet/deaktivert) mens du søker, slik at høyden på toppfeltet er konstant.
- Varelisten beholder skrollposisjonen når du skriver, og produktrutene rerendres uten å bytte identitet, så ingen "sprett" per tastetrykk.
- Deltagerlisten i velgeren skroller til toppen av sin egen liste ved nytt søk, ikke hele siden.

## Teknisk

- Ny migrasjon: `kiosk_sales.client_ref text` + unik indeks, og `record_kiosk_sale(_participant_id uuid, _items jsonb, _client_ref text default null)` som ved konflikt returnerer eksisterende `id` istedenfor å lage nytt salg (idempotent).
- `src/hooks/useKiosk.ts`: `useRecordKioskSale` genererer `crypto.randomUUID()` per kurv og sender den videre.
- `src/pages/Kiosk.tsx`: `submittingRef` (useRef) som guard i `handleCheckout`, `disabled` på hele kurvlinjen under innsending, chipsrad rendres alltid (nedtonet når søk er aktivt), stabile `key` på produktkort.
- `src/components/kiosk/KioskParticipantPicker.tsx`: ingen `autoFocus` (behold `onOpenAutoFocus` preventDefault), scroll-container settes til topp ved endret query.
- Kvitteringssheet: `onOpenAutoFocus` preventDefault på `SheetContent`.