// Predefined activities for Oksnøen
export const ACTIVITIES = [
  { id: 'pil_bue', title: 'Pil & Bue' },
  { id: 'svomming_en_vei', title: 'Svømming til Skrikeren en vei' },
  { id: 'svomming_begge_veier', title: 'Svømming til Skrikeren begge veier' },
  { id: 'tube', title: 'Tube' },
  { id: 'tretten_meter', title: 'Tretten meter' },
  { id: 'atte_meter', title: 'Åtte meter' },
  { id: 'ti_meter', title: 'Ti meter' },
  { id: 'taubane', title: 'Taubane' },
  { id: 'vannski', title: 'Vannski' },
  { id: 'triatlon', title: 'Triatlon' },
  { id: 'klatring', title: 'Klatring' },
  { id: 'skrikern', title: 'Skrikern' },
  { id: 'andre_aktiviteter', title: 'Andre Aktiviteter' },
  { id: 'bruskasse', title: 'Bruskasse' },
  { id: 'rappis', title: 'Rappis' },
  { id: 'outboard', title: 'Outboard' },
] as const;

// Requirements for Store Styrkeprøven
export const STORE_STYRKEPROVE_REQUIREMENTS = [
  'Tretten meter',
  'Taubane',
  'Klatring',
  'Svømming til Skrikeren begge veier',
];

// Requirements for Lille Styrkeprøven
export const LILLE_STYRKEPROVE_REQUIREMENTS = [
  'Åtte meter',
  'Taubane',
  'Klatring',
  'Svømming til Skrikeren en vei',
];

export function hasStoreStyrkprove(completedActivities: string[]): boolean {
  return STORE_STYRKEPROVE_REQUIREMENTS.every((req) =>
    completedActivities.some((a) => a.toLowerCase() === req.toLowerCase())
  );
}

export function hasLilleStyrkprove(completedActivities: string[]): boolean {
  return LILLE_STYRKEPROVE_REQUIREMENTS.every((req) =>
    completedActivities.some((a) => a.toLowerCase() === req.toLowerCase())
  );
}

export function getCompletedCount(completedActivities: string[]): number {
  return completedActivities.length;
}

export function getTotalActivities(): number {
  return ACTIVITIES.length;
}
