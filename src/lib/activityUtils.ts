// Predefined activities for Oksnøen
export const ACTIVITIES = [
  { id: 'pil_bue', title: 'Pil & Bue' },
  { id: 'svomming_en_vei', title: 'Skrikeren en vei' },
  { id: 'svomming_begge_veier', title: 'Skrikeren begge veier' },
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
// All of these must be completed
export const STORE_STYRKEPROVE_REQUIREMENTS = [
  'Tretten meter',
  'Skrikeren begge veier',
  'Klatring',
  'Taubane',
  'Rappis',
];

// Alternative old names that also count (for backwards compatibility)
const STORE_STYRKEPROVE_ALTERNATIVES: Record<string, string[]> = {
  'skrikeren begge veier': ['svømming til skrikeren begge veier'],
};

// Fixed requirements for Lille Styrkeprøven (all must be completed)
export const LILLE_STYRKEPROVE_FIXED_REQUIREMENTS = [
  'Klatring',
  'Rappis',
  'Taubane',
];

// Height alternatives - at least one must be completed (8 meter OR 10 meter)
export const LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES = [
  'Åtte meter',
  'Ti meter',
];

// Swimming alternatives - at least one must be completed (Skrikeren en vei OR Triatlon)
export const LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES = [
  'Skrikeren en vei',
  'Triatlon',
];

// Alternative old names that also count (for backwards compatibility)
const LILLE_STYRKEPROVE_ALTERNATIVES: Record<string, string[]> = {
  'skrikeren en vei': ['svømming til skrikeren en vei'],
};

// Check if activity matches requirement (including old names)
function matchesRequirement(completedActivities: string[], requirement: string, alternatives: Record<string, string[]> = {}): boolean {
  const normalizedReq = requirement.toLowerCase();
  const altNames = alternatives[normalizedReq] || [];
  
  return completedActivities.some((a) => {
    const normalized = a.toLowerCase();
    return normalized === normalizedReq || altNames.includes(normalized);
  });
}

// Check if any of the alternatives are completed
function hasAnyOf(completedActivities: string[], alternatives: string[], altNamesMap: Record<string, string[]> = {}): boolean {
  return alternatives.some(alt => matchesRequirement(completedActivities, alt, altNamesMap));
}

export function hasStoreStyrkprove(completedActivities: string[]): boolean {
  return STORE_STYRKEPROVE_REQUIREMENTS.every((req) =>
    matchesRequirement(completedActivities, req, STORE_STYRKEPROVE_ALTERNATIVES)
  );
}

export function hasLilleStyrkprove(completedActivities: string[]): boolean {
  // All fixed requirements must be met
  const hasAllFixed = LILLE_STYRKEPROVE_FIXED_REQUIREMENTS.every((req) =>
    matchesRequirement(completedActivities, req, LILLE_STYRKEPROVE_ALTERNATIVES)
  );
  
  // At least one height alternative must be met (8 meter OR 10 meter)
  const hasHeight = hasAnyOf(completedActivities, LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES);
  
  // At least one swimming alternative must be met (Skrikeren en vei OR Triatlon)
  const hasSwimming = hasAnyOf(completedActivities, LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES, LILLE_STYRKEPROVE_ALTERNATIVES);
  
  return hasAllFixed && hasHeight && hasSwimming;
}

// Get count of unique activities completed (each activity counts as 1, regardless of how many times done)
export function getUniqueCompletedCount(completedActivities: string[]): number {
  const uniqueActivities = new Set(completedActivities.map(a => a.toLowerCase().trim()));
  return uniqueActivities.size;
}

// Get unique activity names from completed activities
export function getUniqueActivities(completedActivities: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const activity of completedActivities) {
    const normalized = activity.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(activity);
    }
  }
  
  return unique;
}

// Legacy function - counts all instances (kept for backwards compatibility)
export function getCompletedCount(completedActivities: string[]): number {
  return completedActivities.length;
}

export function getTotalActivities(): number {
  return ACTIVITIES.length;
}

// Export requirements for display purposes
export const LILLE_STYRKEPROVE_REQUIREMENTS = [
  ...LILLE_STYRKEPROVE_FIXED_REQUIREMENTS,
  'Åtte meter eller Ti meter',
  'Skrikeren en vei eller Triatlon',
];
