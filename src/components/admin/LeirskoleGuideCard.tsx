import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, HelpCircle } from 'lucide-react';

const STEPS: { title: string; where: string; body: string }[] = [
  {
    title: '1. Uke og bemanning',
    where: 'Fanen «Oversikt»',
    body:
      'Velg/opprett uka og legg inn hvem som jobber (staff). Kompetansen til hver leder bestemmer hvilke aktiviteter de kan få. Her gir du også tilgang og kan «se som» en leder.',
  },
  {
    title: '2. Vakter (øktene i døgnet)',
    where: 'Fanen «Vaktplan» → kortet «Økter/vakter»',
    body:
      'Dette er tidene: frokost, økt 1, middag, økt 2, kvelds, økt 3, Sanitas og nattevakt. Du kan endre klokkeslett, antall ledere, legge inn egne økter og forskyve hele dagen eller uka. Økt 3 lages upublisert — lederne ser den først når du slår på «Publisert for lederne».',
  },
  {
    title: '3. Vaktplan-generator',
    where: 'Fanen «Vaktplan» → «Generer vaktplan»',
    body:
      'Fordeler lederne på vaktene automatisk: maks ca. 8 timer per dag, 11 timer hvile, sammenhengende vakter foretrekkes, maks 2 på måltider og 4 på Sanitas. Endrer du en leder manuelt, låses valget og resten rebalanseres.',
  },
  {
    title: '4. Ukeplanlegger (hva som skjer)',
    where: 'Fanen «Økter» eller «Vaktplan» → «Ukeplanlegger»',
    body:
      'Rutenettet med dagene bortover og økt 1–3 nedover. Her velger du aktivitetene fra lista (ingen skriving) og fargekoder rutene. Dette er selve programmet for uka.',
  },
  {
    title: '5. Aktiviteter til lederne',
    where: 'Fanen «Økter» → «Aktiviteter per økt»',
    body:
      'Henter aktivitetene rett fra ukeplanleggeren (økt 1 = formiddag, økt 2 = ettermiddag) og fordeler dem rettferdig på lederne som er på vakt — færrest ganger først, og kompetanse respekteres. «Generer dagen + varsle» sender push til lederne.',
  },
  {
    title: '6. Aktivitetslista',
    where: 'Fanen «Økter» → «Aktiviteter»',
    body:
      'Her ligger alle aktivitetsnavnene (Tube, Klatring, Pil og bue …). Legg til nye, endre navn/emoji, sorter eller slå av. Alt annet velger fra denne lista.',
  },
  {
    title: '7. Oppgaver og info',
    where: 'Fanen «Oppgaver»',
    body:
      'Gi konkrete oppgaver til enkeltledere med frist, og legg inn info til en økt. Lederne ser dette på sin hjemskjerm og får varsling.',
  },
];

/** Kort forklaring for nye admins: hva er hva i leirskole-panelet. */
export function LeirskoleGuideCard() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="oks-ls-pill p-3">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
        <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold">Slik funker det — kort forklaring</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-2xl bg-muted/40 px-3 py-2">
            <p className="text-sm font-semibold">{s.title}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">{s.where}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
        <p className="px-1 text-[11px] text-muted-foreground">
          Rekkefølge: bemanning → vakter → generer vaktplan → ukeplanlegger → aktiviteter + varsling.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}