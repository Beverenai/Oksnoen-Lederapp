# Svar (ingen endringer)

1. **Backend:** Lovable Cloud (ett felles oppsett for forhåndsvisning og publisert app). Region er ikke kontrollert.
2. **Innlogging:** med telefonnummer via `phone-login` (pluss PIN for admin). Kontoer ligger som e-postbrukere i bakgrunnen. Det er cirka 125 brukere.
3. **Lagring:**
   - Offentlige: participant-images (~1 673 filer) og fix-images (63).
   - Lukkede: gjenglemt-images (269), pov-photos (181) og chat-images (1).
4. **Kobling til de to andre appene:**
   - Funksjon `hub-api`, som bare leser data. Hemmeligheten er `HUB_API_KEY`, og bruken logges i `hub_api_log`.
   - `sync-leirskole-jobb` henter data inn med `LEIRSKOLE_JOBB_EXPORT_URL` og `LEIRSKOLE_SYNC_SECRET`.
   - `sync-leaders-from-sheet` henter fra et regneark, ikke fra hub-en.
   - Tidsstyrte jobber: bare to varsler for morderleken. Ingen av dem synker med de andre appene.
5. **Største risikoer og hva vi bør gjøre:**
   - **Barnebilder er offentlige.** participant-images er åpen, så den som har lenken kan se bildet. Gjør mappen lukket og bruk tidsbegrensede lenker.
   - **Én felles nøkkel gir tilgang til alt.** HUB_API_KEY åpner alle tabeller. Gi hver app sin egen nøkkel, bytt nøklene jevnlig og begrens hvilke verktøy hver nøkkel kan bruke.
   - **Person-ID kan bli feil.** Mange bookinger mangler `participant_id` (376 av 964). Det kan koble feil barn til feil familie. Lagre felles person-ID på alle deltakere og bookinger, og stopp gjetting på navn.
   - **Data kan komme ut av takt.** Det finnes ingen fast synk med hub-en. Bestem hvilken app som eier hvilke data. Hub-en eier barn og foresatte, lederappen eier aktiviteter og ankomst. La appene lese fra eieren, ikke kopiere.
   - **Følsomme data kan lekke.** Sykepleiernotater, hendelser og kontaktinfo til foresatte skal aldri ut. Kjør `helsesjekk` og les gjennom `hub_api_log` jevnlig.
   - **Svak innlogging.** Ledere logger inn bare med telefonnummer. Vurder SMS-kode eller PIN for alle, ikke bare admin.
   - **Ubrukte hemmeligheter.** Rydd bort gamle hemmeligheter og ubrukte funksjoner.
