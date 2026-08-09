# Snusboks og Postkasse som runde pucker på hjem

I dag ligger snusen som en liten "Snus brothers"-pille over hurtigknappene, og Postkassen finnes bare i Mer. Begge flyttes inn i den runde knapperaden ved siden av Hendelser.

## Slik blir det

Knapperaden på hjem:

```text
   ( ! )        ( snus )       ( 📬 )        ( telt )
 HENDELSER       SNUS         POSTKASSE   OVERNATTING
```

- **Snus-puck**: samme runde form/størrelse som Hendelser, men fylt med snusboksen sett rett ovenfra – en rund puck med lokkfarge, ytre ring og en liten glans, i produktets farger. Trykk åpner "Snus brothers"-listen hvis du har brothers, ellers snusvalget på profilen. Har du brothers vises antallet som en liten teller på pucken. Puckens etikett er "Snus" (eller "Snus brothers" når du har noen).
- Vises bare for ledere som har valgt snus. Den gamle pille-knappen over raden fjernes, men sheeten med snus brothers beholdes som den er.
- **Postkasse-puck**: liten 3D-aktig postkasse (tegnet i SVG med lys/skygge, lokk og rødt flagg) i samme runde knapp. Trykk går til `/postkasse`. For admin vises en rød teller med antall nye meldinger; for vanlige ledere en liten prikk hvis du har fått nytt svar fra admin.

Alt annet på hjemskjermen står urørt.

## Teknisk

- `src/components/home/HomeQuickActions.tsx`: utvid `QuickAction` med `visual?: ReactNode` (erstatter ikonet når satt) og `count?: number` (teller i hjørnet). Ingen endring for eksisterende knapper.
- Ny `src/components/snus/SnusPuck.tsx`: rund topp-visning av snusboksen basert på `snusTheme(product)` fra `src/lib/snusCatalog.ts`, med størrelsesprop.
- Ny `src/components/mailbox/MailboxIcon3D.tsx`: liten isometrisk postkasse i SVG med gradient/skygge.
- `src/pages/Home.tsx`: legg snus- og postkasse-handlinger inn i `quickActions` (snus rett etter Hendelser, deretter Postkasse), fjern den gamle snus-pillen, gjenbruk `useMailboxUnreadCount` for admin-teller og `useMyMailboxMessages` for svar-prikk.

Ingen databaseendringer.
