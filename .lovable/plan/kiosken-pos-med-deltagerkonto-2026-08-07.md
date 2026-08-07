# Kiosken – POS med deltagerkonto

En ny "Kiosk"-funksjon der ledere kan slå inn kjøp på en berøringsvennlig kasse. Hver deltager har en kioskkonto som trekkes ned ved kjøp.

## Slik fungerer kassen

- Ny side `/kiosk`, tilgjengelig for alle innloggede ledere via en rund knapp på Hjem og en flis i "Mer".
- Layout som en ekte POS, optimalisert for mobil og iPad:
  - Fargede varefliser gruppert i kategorier (Brus, Chips, Godteri, Sjokolade) – samme fargekoder som kassa-bildet.
  - Handlekurv nederst med antall, linjer og totalsum.
  - Deltager kan velges **før eller etter** varene: knapp "Velg deltager" øverst, og hvis kurven fullføres uten deltager blir man bedt om å velge da.
  - Deltagersøk med bilde, hytte, lag og **saldo** synlig.
- Fullfør salg: trekker totalsummen fra deltagerens kioskkonto, viser kvittering med hvem som slo det inn.
- Hvis saldoen ikke dekker kjøpet: tydelig advarsel, men salget kan fullføres likevel (negativ saldo markeres rødt).
- Angre: siste salg kan annulleres fra kvitteringen eller salgshistorikken, og beløpet legges tilbake.

## Kioskkonto (saldo)

- Startsaldo hentes automatisk fra booking-informasjonen (`kiosk_money` fra bookingimporten).
- Admin kan legge inn påfyll, korreksjon eller utbetaling av restbeløp per deltager.
- Saldo = sum innskudd − sum kjøp, alltid regnet ut fra transaksjonene (ingen løs tallkolonne som kan bli feil).
- Saldo og kjøpshistorikk vises på deltagerkortet i Passkontroll.

## Admin: varekatalog

Egen fane i Admin-innstillinger:
- Legge til / redigere / skjule varer: navn, pris, kategori, farge, rekkefølge.
- Kategorier kan redigeres og sorteres.
- Varene fra prisplakatene og kassa-bildet legges inn som utgangspunkt:
  - Brus 35: Cola, Cola Zero, Fanta Appelsin, Solo/Solo Super, Pepsi Max, Sprite, Urge, Villa
  - Chips: Kims Sour Cream & Onion 45, Kims Paprika Kick 45, Cheez Doodles 45, Petters Gullchips 35
  - Godteri: Gott & Blandat 25, Knattar Skogsbær 30, Bubs 30, Fizzypop 30, Haribo Roulette 20, Maoam 20, Vepsebol 15, Love Hearts 15, Kjærlighet på pinne 10
  - Sjokolade: Kvikk Lunsj 20, Kinder maxi 15, Stratos 25, Japp 25, Kinder Bueno 25, Twix 25, Toppris 25, Krokanrull 30, Smil 25, Melkerull 35

## Statistikk og eksport

Ny "Kiosk"-fane i statistikk:
- Omsetning totalt, per dag og dagsoppgjør.
- Salg per vare (antall + kroner), bestselgere.
- Salg per deltager med gjenstående saldo, og hvem som har negativ saldo.
- Hvilken leder som har slått inn hva.
- Excel-eksport av alle salg og saldoer, og kiosken tas med i Periodearkiv.

## Teknisk

- Nye tabeller (knyttet til `period_id` med `set_period_id_default`-trigger, `updated_at`-trigger og GRANTs):
  - `kiosk_categories` (navn, farge, sortering)
  - `kiosk_products` (navn, pris, kategori, farge, sortering, `is_active`)
  - `kiosk_sales` (deltager, leder, total, tidspunkt, `voided_at`)
  - `kiosk_sale_items` (salg, produkt, navn + pris kopiert inn, antall)
  - `kiosk_deposits` (deltager, beløp, type: booking/påfyll/korreksjon/utbetaling, leder)
- RLS: alle aktive ledere kan lese katalogen og opprette salg; kun admin kan redigere katalogen, gjøre innskudd og annullere salg.
- Saldo leses fra en `kiosk_balances`-visning (innskudd − ikke-annullerte salg).
- Salg opprettes via en `security definer`-funksjon `record_kiosk_sale(participant_id, items jsonb)` som skriver salg + linjer atomisk og henter prisene fra katalogen (ikke fra klienten).
- Frontend: `src/pages/Kiosk.tsx`, `src/components/kiosk/*` (ProductGrid, Cart, ParticipantPicker, Receipt), `src/hooks/useKiosk.ts`, admin-fane `KioskProductsTab.tsx`, statistikkfane `KioskStatsTab.tsx`.
- Optimistiske oppdateringer med React Query og haptisk feedback ved trykk på varefliser.