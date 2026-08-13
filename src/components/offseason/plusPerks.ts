import {
  Sun,
  Circle,
  HeartHandshake,
  Music4,
  ShieldOff,
  CalendarClock,
  BedDouble,
  UtensilsCrossed,
  AlarmClock,
  Beer,
  Repeat2,
  Flame,
  Droplets,
  ClipboardX,
  Baby,
  type LucideIcon,
} from 'lucide-react';

export type PlusPerk = {
  key: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Perks that are actually implemented link somewhere instead of teasing. */
  to?: string;
};

export type PlusPerkGroup = {
  label: string;
  perks: PlusPerk[];
};

/** Alle Øksnøen +-fordeler, gruppert. Én kilde for dialog, hjem og «Mer». */
export const PLUS_PERK_GROUPS: PlusPerkGroup[] = [
  {
    label: 'Søvn og komfort',
    perks: [
      { key: 'sleep-choice', icon: BedDouble, title: 'Velg soveplass', desc: 'Du bestemmer selv hvor du skal sove' },
      { key: 'sleep-in', icon: AlarmClock, title: 'Kvarter lenger søvn', desc: '15 minutter ekstra hver morgen' },
      { key: 'shower', icon: Droplets, title: 'Rituals i dusjen', desc: 'Premium shampo og garantert varmtvann' },
    ],
  },
  {
    label: 'Aktiviteter',
    perks: [
      { key: 'preview', icon: CalendarClock, title: 'Aktivitet 24t før', desc: 'Se hvilken aktivitet du har et døgn i forveien' },
      { key: 'swap', icon: Repeat2, title: 'Bytt aktivitet', desc: 'Bytt aktivitet med en annen leder én gang' },
      { key: 'sanitas', icon: ClipboardX, title: 'Slipper Sanitas', desc: 'Fritak fra Sanitas hele perioden' },
      { key: 'photos', icon: Baby, title: 'Se bilde av barna', desc: 'Full tilgang til bilder av deltagerne' },
    ],
  },
  {
    label: 'Mat og drikke',
    perks: [
      { key: 'table', icon: UtensilsCrossed, title: 'Ekstra tilbehør', desc: 'Premium tilbehør på Lederbordet' },
      { key: 'units', icon: Beer, title: '2 ekstra enheter', desc: 'Om kvelden – og lov til å bli full én gang i perioden' },
    ],
  },
  {
    label: 'Sosialt',
    perks: [
      { key: 'tinder', icon: Flame, title: 'Tinder for ledere', desc: 'Sveip på lederne og få match', to: '/kline-tinder' },
      { key: 'queue', icon: HeartHandshake, title: 'Prioritert klinekø', desc: 'Hopp foran i køen på klinelista' },
      { key: 'chat', icon: ShieldOff, title: 'Reklamefritt Lederhuset', desc: 'Ingen forstyrrelser i chatten' },
    ],
  },
  {
    label: 'Status',
    perks: [
      { key: 'sun', icon: Sun, title: 'Ubegrenset sol', desc: 'Tilgang til Øksnøen-sola året rundt' },
      { key: 'gold-snus', icon: Circle, title: 'Gullsnus', desc: 'Eksklusiv snusboks i 24 karat' },
      { key: 'fanfare', icon: Music4, title: 'Egen fanfare', desc: 'Spilles automatisk når du går ned til brygga' },
    ],
  },
];

export const PLUS_PERKS: PlusPerk[] = PLUS_PERK_GROUPS.flatMap((g) => g.perks);

/** Tre fordeler som fremheves i toppen av salgssiden. */
export const PLUS_HIGHLIGHTS: PlusPerk[] = ['sleep-in', 'units', 'sleep-choice']
  .map((k) => PLUS_PERKS.find((p) => p.key === k)!)
  .filter(Boolean);
