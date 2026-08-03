## 1. Hjemskjerm (retning: «Nordisk med chips»)

Ny struktur på `/` (mobil først):

```text
[ (refresh, diskret øverst høyre) ]
        (profilbilde, sentrert, 96px)
        Fullt navn (sentrert)
   [ Hytte-chip ] • [ Rolle/minister-chip ]

   ( ! )      ( telt )     ( ... )
 Hendelser  Overnatting   (flere senere)

 [ Aktiviteter denne økten - hovedkort ]
 [ Øvrige kort: obs-melding, kjøkkentjeneste osv. ]
 [ Morder-leken: liten boks helt nederst (kun når aktiv) ]
```

- Passet (LederPass) fjernes fra hjemskjermen.
- Dødningskalle-ikonet ved profilbildet fjernes; Morder-leken blir en liten mørk boks nederst + en knapp på «Mer».
- Overskriften «Denne økten skal du …» fjernes over aktivitetskortet — aktivitetskortet står alene.
- Overnatting-kortet med slider fjernes fra feeden; erstattes av rund telt-knapp.
- Runde knapper bygges som en gjenbrukbar `HomeQuickActions`-rad som tåler 2–5 knapper (wrapper til ny linje).

## 2. Passet som egen feature i «Mer»

- Ny rute `/lederpass` som viser `LederPass` i fullskjerm (samme swipe-rail som i dag).
- Ny flis «Lederpasset» i `More.tsx` under «Min side».
- Pass-ikonet fjernes fra hjemskjermen (beholdes i bunnnavigasjonens Passkontroll-ikon, som er noe annet).

## 3. Hendelser

- Rund rød/rose «!»-knapp på hjem → `/hendelser`.
- Øverst på Hendelser-siden: kort hjelpetekst «Skriv inn her alt — stort og smått som har skjedd».
- Fjerner den doble tilbakeknappen: `Hendelser.tsx` har egen tilbakeknapp *i tillegg* til layoutens sub-side-tilbakeknapp. Løsning: sidene beholder kun tittelen, og layoutens tilbakeknapp er den ene sanne. Jeg går gjennom sidene som har egen `ArrowLeft`-knapp (Hendelser m.fl.) og fjerner duplikatene.

## 4. Toppmeny på mobil

- Fjerner Øksnøen-logo + ledernavn fra mobil-headeren.
- iOS trenger ingen egen toppmeny: på hovedfanene (Hjem/Passkontroll/Ledere/Mer) skjules headeren helt, og på undersider vises en tynn header med kun tilbakeknapp + sidetittel. Safe-area-padding beholdes så innholdet ikke havner under statuslinjen.

## 5. Overnatting: tvunget første svar + endre senere

- Rund telt-knapp ved siden av Hendelser vises kun når `overnatting_enabled = true` → åpner et ark der leder kan endre svaret sitt (Ja/Nei).
- Første gang funksjonen er aktiv får lederen en modal som **ikke** kan lukkes ved sveip/utenfor-klikk — kun to knapper: **Ja** og **Nei**. Etter valg lagres svaret i `overnatting_responses` og modalen forsvinner.
- Ledere som ikke har svart (ingen rad for aktiv runde) får modalen ved neste appstart.

## Teknisk

- Filer: `src/pages/Home.tsx` (omskriving av topp/feed), ny `src/components/home/HomeQuickActions.tsx`, ny `src/components/home/OvernattingGateDialog.tsx` og `OvernattingSheet.tsx`, ny `src/pages/LederpassPage.tsx` + rute i `src/App.tsx`, `src/pages/More.tsx`, `src/components/layout/AppLayout.tsx` (header), `src/pages/Hendelser.tsx`.
- Ingen databaseendringer nødvendig: `overnatting_responses` + `app_config`-nøklene finnes. Admin nullstiller allerede svar når funksjonen skrus på, så «første gang»-modalen trigges naturlig av manglende rad.
- Design bruker eksisterende semantiske tokens (primary/muted/card), ikke hardkodede farger; chips og runde knapper får samme radius/skygge som valgt retning.
