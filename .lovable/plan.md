# Postkasse

En digital postkasse der ledere kan sende inn spørsmål, forslag og meldinger anonymt utad, mens admin kan se hvem som sendte den. Admin får en "You got mail"-varsling ved nye meldinger.

## Slik fungerer det

**For ledere (`/postkasse`)**
- Visuell postkasse (lokk/luke som animerer når du sender) med "Legg i postkassen"-knapp
- Skjema: kategori (Spørsmål, Forslag, Ros, Bekymring, Annet) + fritekst
- Valg: "Send anonymt" er på som standard. Innsenderen ser tydelig at admin kan se hvem det er (ingen falsk anonymitet).
- Egen liste "Mine meldinger" med status (Ny / Lest / Besvart) og admins svar
- Tilgjengelig for alle innloggede (leder, nurse, kjøkken)

**For admin (`/postkasse` med adminvisning)**
- Innboks med filtre (Ny / Lest / Besvart / Alle) og kategorier
- Ser avsender (navn + bilde) selv når meldingen er markert anonym
- Kan markere som lest, skrive svar (som vises hos avsender) og arkivere
- Uleste-teller vises som badge på Postkasse-flisen i Mer

**Varsling**
- Når en melding sendes inn får alle admins push: "Du har fått post!" med kort utdrag
- Trykk på varselet åpner Postkasse-innboksen direkte

## Teknisk

Database (én migrasjon):
- `mailbox_messages`: kategori, innhold, is_anonymous, sender_leader_id, status, admin_reply, replied_by, replied_at, read_at, period_id (auto via `set_period_id_default`), tidsstempler + updated_at-trigger
- Grants + RLS: innsender kan lese/opprette egne rader; admin kan lese alle og oppdatere status/svar. Ingen delete for vanlige brukere.

Kode:
- `src/pages/Mailbox.tsx` + rute `/postkasse` i `App.tsx`
- `src/components/mailbox/`: `MailboxIllustration.tsx` (animert postkasse), `NewMessageSheet.tsx`, `MyMessagesList.tsx`, `AdminInbox.tsx`
- `src/hooks/useMailbox.ts` (React Query: send, liste, uleste-teller, realtime-abonnement)
- Ny flis "Postkasse" i `src/pages/More.tsx` med uleste-badge for admin
- Push: gjenbruk `push-admin-alert` fra klienten ved innsending, med destinasjon lagt til i `src/lib/pushDestinations.ts` slik at trykk går til `/postkasse`

Ingen endringer i eksisterende moduler utover Mer-siden og push-destinasjoner.
