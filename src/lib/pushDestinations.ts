export interface PushDestination {
  label: string;
  url: string;
}

/** Sider et varsel kan lenke til når man trykker på det */
export const PUSH_DESTINATIONS: PushDestination[] = [
  { label: 'Hjem', url: '/' },
  { label: 'Morder-leken', url: '/morder' },
  { label: 'Hendelser', url: '/hendelser' },
  { label: 'Passkontroll', url: '/passport' },
  { label: 'Ledere', url: '/leaders' },
  { label: 'Mine hytter', url: '/my-cabins' },
  { label: 'Mine vakter', url: '/my-shifts' },
  { label: 'Vaktplan', url: '/schedule' },
  { label: 'Viktig info', url: '/important-info' },
  { label: 'Gjenglemt', url: '/gjenglemt' },
  { label: 'Fix', url: '/fix' },
  { label: 'Tauverk-kontroll', url: '/rope-control' },
  { label: 'Gensere', url: '/gensere' },
  { label: 'Nurse', url: '/nurse' },
  { label: 'Chat', url: '/chat' },
  { label: 'Postkasse', url: '/postkasse' },
  { label: 'Klineliste', url: '/klineliste' },
  { label: 'Lederpass', url: '/lederpass' },
  { label: 'Snusvalg', url: '/profile?snus=1' },
  { label: 'Mer', url: '/mer' },
];

export const isKnownPushUrl = (url: string) =>
  PUSH_DESTINATIONS.some((d) => d.url === url);
