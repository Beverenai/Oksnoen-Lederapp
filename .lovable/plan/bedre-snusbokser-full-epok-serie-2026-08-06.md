# Bedre snusbokser + full Epok-serie

## Mål
Boksene skal se ut som ekte snusbokser, Epok skal ha hele sortimentet (det er den mest brukte), og valget i Min profil skal være rent: søk + boks — ingen tekstlinjer med «Kald mint / Helhvit / Styrke S2». All slik info leses av selve boksen.

## 1. Ny, mer realistisk 3D-boks
Boksen bygges om slik at den ligner en faktisk boks sett litt ovenfra:

- Ekte sylinder: lokk, sidevegg og bunn, med skarp kant mellom lokk og vegg.
- Riktig lys: mykt høylys øverst til venstre, gradvis skygge mot høyre, tydelig kantlys på sideveggen og en mykere skygge under boksen.
- Sideveggen får merkefarge + merkenavn repetert rundt hele boksen, slik at det ser riktig ut når man roterer.
- Lokket får merkets faktiske oppsett: stort merkenavn, «No»-nummer i stor skrift for Epok-serien, smaksnavn, format (slim/mini/porsjon) og styrkeprikker.
- Roteringen blir smooth: dra-bevegelsen oppdaterer boksen direkte uten at hele komponenten tegnes på nytt, med litt utglidning når du slipper. Roterer sakte av seg selv til man tar tak.

## 2. Hele Epok-sortimentet
Epok legges inn komplett (hentet fra Meny og norske snusbutikker) og vises først i listen siden det er mest brukt:

No1 Ice Blue, No2 Arctic Blue, No3 Zest Green, No4 Purple, No5 Tropic Breeze, No7 Freeze, No9 Urban Blue, No11 Frosty Green, No12 Frosty Green Mini, No19 Ice Blue Mini, No20 Freeze, No21 Freeze, No23 Mountain Storm, No26 Jalapeno Lime, No27 Pink Burst, No28 Strawberry Ice, No32 Frosty Green, No34 Spicy Dragon Fruit, No35 Spicy Peach, No36 Strawberry Mini, No37 Ice Blue, No38 Icy Berries Mini, No39 Smooth Peppermint Mini, No40 Smooth Peppermint, No41 Smooth Peppermint, No42 Tangy Lime Mini, No43 Spearmint Storm, No44 Guava Jalapeno, No46 Blueberry Ice, No47 Minty Lemon, No102 Dark Original, samt de nikotinfrie: Peppermint ZERO, Smooth Peppermint ZERO, Wintry Watermelon ZERO og Breezy Mango.

Hver variant får riktig nummer, smak, format (slim/mini/porsjon) og styrke på Epoks 1–7-skala, samt en lokkfarge som matcher den faktiske boksen (blå, grønn, lilla, rosa, rød osv.). De andre merkene (General, Skruf, The Lab, Siberia, Loop, Odens, Lundgrens, Ettan, Knox, XR) beholdes som i dag.

## 3. Renere valg i Min profil
- Søkefeltet blir hovedinngangen: søk på merke, nummer, smak eller format («epok», «no21», «mango», «mini»).
- Merke-chips over listen for rask filtrering, med Epok først.
- De fire infolinjene under boksen fjernes helt. Kun navnet på valgt boks + «Velg denne».
- Boksen blir større og kan sveipes/dras sideveis for å bla mellom treffene.
- «Finner du ikke din snus?» beholdes for egen tekst.
- Samme søk brukes også når man bytter boks fra profilen, så man aldri må bla gjennom hele listen.

## Teknisk
- `src/lib/snusCatalog.ts`: utvid `SnusProduct` med `number` (Epok No), `format` ('slim' | 'mini' | 'porsjon' | 'løs') og `nicotineFree`; styrkeskala utvides til 1–7; Epok-blokken erstattes med full liste og katalogen sorteres med Epok først. `searchSnus` matcher også nummer og format.
- `src/components/snus/SnusCan3D.tsx`: skrives om — sylinder av segmenter + lokk + bunn, lyssetting via gradienter, rotasjon styrt med `ref` + `requestAnimationFrame` (ingen `setState` per frame) og treghet ved slipp.
- `src/components/snus/SnusPicker.tsx`: fjern `Row`-komponenten og infoblokken, legg til merke-chips, større boks og sveip mellom treff.
- `src/components/snus/SnusBadge.tsx` og lederdetaljer henter merkefarge/nummer fra det utvidede feltsettet. Datalagringen er uendret (`snus_user`, `snus_product_id`, `snus_custom_label`).