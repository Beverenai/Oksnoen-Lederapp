import { ACTIVITIES, ACTIVITY_NAME_MAPPING, STATS_ACTIVITY_GROUPING } from './activityUtils';

// Build a set of all known "standard" activity names (lowercased).
const STANDARD_ACTIVITY_NAMES: Set<string> = (() => {
  const s = new Set<string>();
  ACTIVITIES.forEach((a) => s.add(a.title.toLowerCase().trim()));
  Object.keys(STATS_ACTIVITY_GROUPING).forEach((k) => s.add(k.toLowerCase().trim()));
  Object.values(STATS_ACTIVITY_GROUPING).forEach((v) => s.add(v.toLowerCase().trim()));
  Object.entries(ACTIVITY_NAME_MAPPING).forEach(([k, alts]) => {
    s.add(k.toLowerCase().trim());
    alts.forEach((alt) => s.add(alt.toLowerCase().trim()));
  });
  return s;
})();

function canonicalName(name: string): string {
  const n = name.toLowerCase().trim();
  return (STATS_ACTIVITY_GROUPING[n] || n).toLowerCase().trim();
}

export function isStandardActivity(name: string): boolean {
  return STANDARD_ACTIVITY_NAMES.has(name.toLowerCase().trim());
}

/**
 * Compute per-participant points.
 * - Standard activities: 1 point per unique activity (deduped by canonical name)
 * - Custom activities: 1 point per registration
 * - Insjpoeng: participant.insj_points
 * - Bonus: sum of participant_bonus_points.points
 */
export function computeParticipantPoints(input: {
  activities: Array<{ activity: string }>;
  insjPoints: number;
  bonusPoints: number;
}): { activities: number; secretWord: number; bonus: number; total: number } {
  const uniqueStandard = new Set<string>();
  let customCount = 0;
  for (const a of input.activities) {
    if (!a?.activity) continue;
    if (isStandardActivity(a.activity)) {
      uniqueStandard.add(canonicalName(a.activity));
    } else {
      customCount += 1;
    }
  }
  const activities = uniqueStandard.size + customCount;
  const secretWord = input.insjPoints || 0;
  const bonus = input.bonusPoints || 0;
  return { activities, secretWord, bonus, total: activities + secretWord + bonus };
}