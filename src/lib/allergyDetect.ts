export type AllergyCategory = {
  key: string;
  label: string;
  /** Kort kjøkken-instruks */
  hint: string;
  patterns: RegExp[];
};

/**
 * Norske nøkkelord for matrelaterte allergier/dietter.
 * Rekkefølgen styrer visningen (mest kritisk først).
 */
export const ALLERGY_CATEGORIES: AllergyCategory[] = [
  {
    key: 'nuts',
    label: 'Nøtter',
    hint: 'Ingen nøtter i mat eller pålegg. Sjekk pesto, sjokolade og müsli.',
    patterns: [/n[øo]tte?r?\s?allergi/i, /allergi\w*\s+(mot|for)\s+n[øo]tter/i, /peanø?tt/i, /n[øo]ttefri/i, /mandel(allergi)?/i, /cashew/i, /hasselnøtt/i, /valnøtt/i],
  },
  {
    key: 'gluten',
    label: 'Gluten / cøliaki',
    hint: 'Glutenfritt brød, pasta og saus. Eget skjærebrett og smør.',
    patterns: [/c[øo]liak/i, /gluten/i, /hvetealler/i, /spelt(allergi)?/i],
  },
  {
    key: 'lactose',
    label: 'Melk / laktose',
    hint: 'Laktosefri melk og smør. Sjekk sauser og dressing.',
    patterns: [/laktose/i, /melkeal+ergi/i, /melkeprotein/i, /kum(elk|jølk)/i, /melkefri/i, /ku?melk/i],
  },
  {
    key: 'egg',
    label: 'Egg',
    hint: 'Ingen egg til frokost. Sjekk majones, vafler og kaker.',
    patterns: [/egge?al+ergi/i, /allergi\w*\s+(mot|for)\s+egg/i, /eggefri/i],
  },
  {
    key: 'fish',
    label: 'Fisk / sjømat',
    hint: 'Alternativ middag på fiskedager. Sjekk kaviar og fiskepudding.',
    patterns: [/fiske?al+ergi/i, /sk?alldyr/i, /skjell?al+ergi/i, /reker?al+ergi/i, /allergi\w*\s+(mot|for)\s+(fisk|skalldyr|reker)/i, /spiser ikke fisk/i, /t[åa]ler ikke fisk/i],
  },
  {
    key: 'soy',
    label: 'Soya',
    hint: 'Sjekk soyasaus, vegetarpølser og brød.',
    patterns: [/soya?al+ergi/i, /allergi\w*\s+(mot|for)\s+soya/i, /soyafri/i],
  },
  {
    key: 'vegetarian',
    label: 'Vegetar / vegan',
    hint: 'Kjøttfri hovedrett hver middag.',
    patterns: [/vegetar/i, /vegan/i, /spiser ikke kj[øo]tt/i, /kj[øo]ttfri/i],
  },
  {
    key: 'pork',
    label: 'Spiser ikke svin',
    hint: 'Alternativ til bacon, pølse og skinke.',
    patterns: [/spiser ikke svin/i, /ikke svinekj[øo]tt/i, /halal/i, /svinefri/i],
  },
  {
    key: 'fruit',
    label: 'Frukt / grønt',
    hint: 'Se notat — gjelder ofte rå frukt eller enkelte bær.',
    patterns: [/eplea?l+ergi/i, /banana?l+ergi/i, /sitrusal+ergi/i, /jordb[æa]ral+ergi/i, /kiwial+ergi/i, /allergi\w*\s+(mot|for)\s+(eple|banan|kiwi|sitrus|jordb[æa]r|tomat)/i],
  },
  {
    key: 'other',
    label: 'Annen matallergi / diett',
    hint: 'Les notatet — avklar med sykepleier ved tvil.',
    patterns: [/matal+ergi/i, /matvarea?l+ergi/i, /spesialkost/i, /di[eé]tt/i, /intoleran/i, /t[åa]ler ikke\s+\w+/i],
  },
];

/** Ord som betyr at "allergi" ikke handler om mat. */
const NON_FOOD = /(pollen|bj[øo]rk|gress|katt|hund|dyre|st[øo]v|midd|penicil+in|plaster|latex|vepse|bie|insekt|medisin|nikkel|solallergi|astma)/i;

export type AllergyHit = {
  participant_id: string;
  name: string;
  cabin_name: string | null;
  room: string | null;
  categories: string[];
  /** Setningene som traff, for kjøkkenet å lese */
  quotes: string[];
};

const SPLIT = /(?<=[.!?;])\s+|\n+/;

export type NoteRow = {
  participant_id: string;
  name: string;
  cabin_name: string | null;
  room: string | null;
  booking_notes: string | null;
  health_info: string | null;
  participant_notes: string | null;
};

export function detectAllergies(rows: NoteRow[]): AllergyHit[] {
  const out: AllergyHit[] = [];
  for (const r of rows) {
    const text = [r.booking_notes, r.health_info, r.participant_notes]
      .filter(Boolean)
      .join('\n');
    if (!text.trim()) continue;

    const cats = new Set<string>();
    const quotes = new Set<string>();

    for (const sentence of text.split(SPLIT)) {
      const s = sentence.trim();
      if (!s) continue;
      const foodOnly = s.replace(NON_FOOD, '');
      for (const cat of ALLERGY_CATEGORIES) {
        if (cat.patterns.some((p) => p.test(foodOnly))) {
          cats.add(cat.key);
          quotes.add(s.length > 220 ? `${s.slice(0, 220)}…` : s);
        }
      }
    }

    if (cats.size) {
      out.push({
        participant_id: r.participant_id,
        name: r.name,
        cabin_name: r.cabin_name,
        room: r.room,
        categories: [...cats],
        quotes: [...quotes],
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

export function countByCategory(hits: AllergyHit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  hits.forEach((h) => h.categories.forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
  return counts;
}
