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

// Mapping of shortened/alternative activity names to canonical names
export const ACTIVITY_NAME_MAPPING: Record<string, string[]> = {
  'tretten meter': ['tretten', '13 meter', '13m', 'trettenmeteren'],
  'åtte meter': ['åtte', '8 meter', '8m', 'åttemeteren'],
  'ti meter': ['ti', '10 meter', '10m', 'timeteren'],
  'skrikeren begge veier': ['svømming begge veier', 'begge veier', 'svømming til skrikeren begge veier'],
  'skrikeren en vei': ['svømming en vei', 'en vei', 'svømming til skrikeren en vei'],
  'klatring': ['klatre', 'klatrevegg'],
  'rappis': ['rappelering', 'rappell', 'rappelling'],
  'taubane': ['zipline', 'zip-line'],
  'triatlon': ['triathlon'],
};

// Mapping for statistics - groups related activities for display
// Note: This is separate from Styrkeprøven logic which needs distinctions
export const STATS_ACTIVITY_GROUPING: Record<string, string> = {
  // Åtte meter variants
  'åtte': 'Åtte meter',
  'åtte meter': 'Åtte meter',
  '8 meter': 'Åtte meter',
  '8m': 'Åtte meter',
  'åttemeteren': 'Åtte meter',
  
  // Ti meter variants
  'ti': 'Ti meter',
  'ti meter': 'Ti meter',
  '10 meter': 'Ti meter',
  '10m': 'Ti meter',
  'timeteren': 'Ti meter',
  
  // Tretten meter variants
  'tretten': 'Tretten meter',
  'tretten meter': 'Tretten meter',
  '13 meter': 'Tretten meter',
  '13m': 'Tretten meter',
  'trettenmeteren': 'Tretten meter',
  
  // Skrikeren - all variants grouped to one for stats
  'skrikeren': 'Skrikeren',
  'skrikern': 'Skrikeren',
  'skrikeren en vei': 'Skrikeren',
  'skrikeren begge veier': 'Skrikeren',
  'svømming en vei': 'Skrikeren',
  'svømming begge veier': 'Skrikeren',
  'svømming til skrikeren en vei': 'Skrikeren',
  'svømming til skrikeren begge veier': 'Skrikeren',
};

// Normalize activity name for statistics display (groups similar activities)
export function normalizeActivityForStats(activity: string): string {
  const normalized = activity.toLowerCase().trim();
  return STATS_ACTIVITY_GROUPING[normalized] || activity;
}

// Requirements for Store Styrkeprøven
// All of these must be completed
export const STORE_STYRKEPROVE_REQUIREMENTS = [
  'Tretten meter',
  'Skrikeren begge veier',
  'Klatring',
  'Taubane',
  'Rappis',
];

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

// Check if activity matches requirement (including shortened names and alternatives)
export function matchesRequirement(completedActivities: string[], requirement: string): boolean {
  const normalizedReq = requirement.toLowerCase().trim();
  const altNames = ACTIVITY_NAME_MAPPING[normalizedReq] || [];
  
  return completedActivities.some((a) => {
    const normalized = a.toLowerCase().trim();
    
    // Exact match with requirement
    if (normalized === normalizedReq) return true;
    
    // Match with any alternative name
    if (altNames.includes(normalized)) return true;
    
    // Partial match - activity starts with requirement or vice versa
    if (normalized.startsWith(normalizedReq) || normalizedReq.startsWith(normalized)) return true;
    
    // Partial match with alternatives
    if (altNames.some(alt => normalized.startsWith(alt) || alt.startsWith(normalized))) return true;
    
    return false;
  });
}

// Check if any of the alternatives are completed
function hasAnyOf(completedActivities: string[], alternatives: string[]): boolean {
  return alternatives.some(alt => matchesRequirement(completedActivities, alt));
}

export function hasStoreStyrkprove(completedActivities: string[]): boolean {
  return STORE_STYRKEPROVE_REQUIREMENTS.every((req) =>
    matchesRequirement(completedActivities, req)
  );
}

export function hasLilleStyrkprove(completedActivities: string[]): boolean {
  // All fixed requirements must be met
  const hasAllFixed = LILLE_STYRKEPROVE_FIXED_REQUIREMENTS.every((req) =>
    matchesRequirement(completedActivities, req)
  );
  
  // At least one height alternative must be met (8 meter OR 10 meter)
  const hasHeight = hasAnyOf(completedActivities, LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES);
  
  // At least one swimming alternative must be met (Skrikeren en vei OR Triatlon)
  const hasSwimming = hasAnyOf(completedActivities, LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES);
  
  return hasAllFixed && hasHeight && hasSwimming;
}

// Check a single requirement with OR logic (e.g., "Åtte meter eller Ti meter")
export function checkRequirementWithOrLogic(completedActivities: string[], req: string): boolean {
  // Handle "eller" requirements
  if (req.toLowerCase().includes(' eller ')) {
    const alternatives = req.split(/ eller /i);
    return alternatives.some(alt => matchesRequirement(completedActivities, alt.trim()));
  }
  return matchesRequirement(completedActivities, req);
}

// Get progress for Store Styrkeprøven
export function getStoreStyrkproveProgress(completedActivities: string[]): { completed: number; total: number } {
  const completed = STORE_STYRKEPROVE_REQUIREMENTS.filter(req => 
    matchesRequirement(completedActivities, req)
  ).length;
  return { completed, total: STORE_STYRKEPROVE_REQUIREMENTS.length };
}

// Get progress for Lille Styrkeprøven
export function getLilleStyrkproveProgress(completedActivities: string[]): { completed: number; total: number } {
  let completed = 0;
  const total = LILLE_STYRKEPROVE_FIXED_REQUIREMENTS.length + 2; // Fixed + height + swimming
  
  // Count fixed requirements
  completed += LILLE_STYRKEPROVE_FIXED_REQUIREMENTS.filter(req => 
    matchesRequirement(completedActivities, req)
  ).length;
  
  // Check height alternatives
  if (hasAnyOf(completedActivities, LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES)) {
    completed++;
  }
  
  // Check swimming alternatives
  if (hasAnyOf(completedActivities, LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES)) {
    completed++;
  }
  
  return { completed, total };
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
