export interface BonusActivity {
  key: string;
  label: string;
  extra?: string;
}

export const BONUS_ACTIVITIES: BonusActivity[] = [
  { key: 'tube', label: 'Tube', extra: 'I blinde' },
  { key: 'vannski', label: 'Vannski', extra: 'En ski' },
  { key: 'seiling', label: 'Seiling', extra: 'Til og fra strand uten hjelp' },
  { key: 'skrikeren_svomming', label: 'Skrikeren Svømming', extra: '1, 2, 3 plass' },
  { key: 'sjoslag', label: 'Sjøslag', extra: '1, 2, 3 plass' },
  { key: 'triatlon', label: 'Triatlon', extra: '1, 2, 3 plass' },
  { key: 'klatring', label: 'Klatring', extra: 'Toppen av vanskelig vegg' },
  { key: 'raeppis', label: 'Ræppis', extra: 'Under 30 sekunder' },
  { key: 'slottsholmen', label: 'Slottsholmen', extra: '13 meter' },
  { key: 'bruskasser', label: 'Bruskasser', extra: 'Over 20 kasser' },
  { key: 'pil_og_bue', label: 'Pil og bue', extra: '8 eller bedre' },
  { key: 'motorbater', label: 'Motorbåter' },
  { key: 'riding', label: 'Riding' },
  { key: 'tau_bane', label: 'Tau-bane' },
];