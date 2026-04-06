

## Deltakersiden: Hytte-oversikt som landingsside

### Konsept
Erstatt den nåværende tab-baserte layouten med en visuell landingsside som viser:
1. **Statistikk-kort** øverst (ankomst, bursdager, mangler aktivitet — det som er i ParticipantStatsCard i dag)
2. **Navigasjonskort i et grid** — fargerike, lekne kort som tar deg videre til undersidene

### Navigasjonskortene (2-kolonne grid)
Hvert kort har ikon, tittel, kort beskrivelse og en tematisk farge:
- **Rombytter** (ArrowLeftRight, blå) — "Bytt rom mellom deltakere"
- **Hytterapporter** (Home, grønn) — "Se rapporter per hytte"  
- **Utsjekk** (Sparkles, lilla) — "Håndter utsjekk av deltakere"
- **Lederaktivitet** (UserCheck, oransje) — "Se ledernes aktivitetsregistrering"
- **Aktiviteter** (Activity, rosa) — "Statistikk over alle aktiviteter"
- **Eksporter** (Download, grå) — "Last ned rapport"

### Navigasjon
Når man trykker på et kort, navigerer vi til samme side men med en query-param (f.eks. `?tab=room-swap`). Siden sjekker for denne parameteren og viser riktig innhold med en tilbake-knapp øverst.

### Teknisk

**Endringer i `src/pages/admin/ParticipantStats.tsx`:**
- Legg til `useSearchParams` for å lese/sette `?tab=...`
- Hvis ingen `tab`-param: vis landingssiden med statistikk + navigasjonskort-grid
- Hvis `tab`-param finnes: vis riktig komponent (RoomSwapTab, CheckoutTab, osv.) med en tilbake-knapp som fjerner param
- Fjern `Tabs`/`TabsList`/`TabsTrigger` — erstattes av kortene
- Behold `ExportDataSheet` som sheet (åpnes fra eksporter-kortet)

**Filer som endres:**
- `src/pages/admin/ParticipantStats.tsx` — eneste fil

### Resultat
- Landingssiden er visuell og oversiktlig med fargerike kort
- Man trykker seg inn i en seksjon og kan enkelt gå tilbake
- Statistikk (ankomst, bursdager) er alltid synlig på forsiden
- Ingen funksjonalitet fjernes, bare reorganisert

