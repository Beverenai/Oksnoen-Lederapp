import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, HelpCircle } from 'lucide-react';

const STEPS: { title: string; where: string; body: string }[] = [
  {
    title: '1. Ledere',
    where: 'Steg 1',
    body:
      'Legg inn hvem som jobber denne uken, og sett kompetansen deres. Kompetansen bestemmer hvilke aktiviteter de kan få. Her gir du også tilgang og kan «se som» en leder.',
  },
  {
    title: '2. Ukeplan',
    where: 'Steg 2',
    body:
      'Rutenettet med dagene bortover og økt 1–3 nedover. Velg aktivitetene fra lista — dette er programmet for uka, og styrer hva lederne kan settes på. Nye aktivitetsnavn legges inn nederst i samme steg.',
  },
  {
    title: '3. Vaktplan',
    where: 'Steg 3',
    body:
      'Først «Generer vaktplan»: lederne fordeles på frokost, økt 1, middag, økt 2, kvelds, økt 3, Sanitas og nattevakt — maks ca. 8 timer per dag, 11 timer hvile og helst sammenhengende vakter. Deretter «Fordel aktiviteter»: aktivitetene fra ukeplanen gis til ledere med riktig kompetanse som er på vakt i økten, og rullerer så ingen har det samme to økter på rad. Nederst kan du endre hver enkelt manuelt.',
  },
  {
    title: '4. Oppgaver',
    where: 'Steg 4',
    body:
      'Gi konkrete oppgaver til alle eller enkeltledere med frist, og legg inn info til en økt. Lederne ser dette på hjemskjermen og får varsling.',
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
          Rekkefølge: ledere → ukeplan → vaktplan + aktiviteter → oppgaver.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}