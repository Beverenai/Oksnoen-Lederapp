import { LEIRSKOLE_COMPETENCIES, activityRequiresCompetence } from '@/lib/leirskoleCompetencies';

/** Aktivitetene lederne kan settes på — samme nøkler som kompetansene. */
export const LEIRSKOLE_ACTIVITIES = LEIRSKOLE_COMPETENCIES;

export type LeirskoleActivityKey = (typeof LEIRSKOLE_ACTIVITIES)[number]['key'];

/** Øktene som får aktiviteter tildelt i appen (økt 1–3 i ukeplanleggeren). */
export const LEIRSKOLE_ACTIVITY_SESSIONS = [
  { key: 'formiddag', label: '1. økt' },
  { key: 'ettermiddag', label: '2. økt' },
  { key: 'kveld', label: '3. økt' },
] as const;

export type LeirskoleActivitySessionKey = (typeof LEIRSKOLE_ACTIVITY_SESSIONS)[number]['key'];

/** Aktivitetene som kan velges på en gitt økt. Foreløpig kun vannaktiviteter. */
export function activitiesForSession(_session: string) {
  return LEIRSKOLE_ACTIVITIES as readonly { key: string; label: string; emoji: string }[];
}

export function sessionLabel(key: string) {
  return LEIRSKOLE_ACTIVITY_SESSIONS.find((s) => s.key === key)?.label ?? key;
}

export interface ActivityTypeLike {
  key: string;
  label: string;
  emoji: string;
}

export function activityLabel(key: string, types?: readonly ActivityTypeLike[]) {
  return (
    types?.find((a) => a.key === key)?.label ??
    LEIRSKOLE_ACTIVITIES.find((a) => a.key === key)?.label ??
    key
  );
}

export function activityEmoji(key: string, types?: readonly ActivityTypeLike[]) {
  return (
    types?.find((a) => a.key === key)?.emoji ??
    LEIRSKOLE_ACTIVITIES.find((a) => a.key === key)?.emoji ??
    '•'
  );
}

export interface ActivityCandidate {
  leaderId: string;
  name: string;
  /** Kompetanser lederen har. Tom liste = kan alt (ingen registrert kompetanse). */
  competencies: string[];
}

export interface ActivityHistoryRow {
  leader_id: string;
  activity: string;
}

export interface GeneratedActivity {
  leaderId: string;
  name: string;
  activity: LeirskoleActivityKey | string;
  /** true hvis lederen har hatt aktiviteten før (alle har fått den minst én gang). */
  repeat: boolean;
  /** true hvis lederen mangler registrert kompetanse på aktiviteten. */
  outsideCompetence: boolean;
}

/**
 * Rettferdig fordeling: lederen som har hatt aktiviteten færrest ganger får den først,
 * og ingen får samme aktivitet igjen før alle (som kan den) har hatt den.
 * Kompetanse respekteres når noen faktisk har kompetansen.
 */
export function generateActivityAssignments(
  candidates: ActivityCandidate[],
  history: ActivityHistoryRow[],
  activities: readonly string[] = LEIRSKOLE_ACTIVITIES.map((a) => a.key),
  requireCompetence = true,
): GeneratedActivity[] {
  const counts = new Map<string, number>(); // `${leaderId}|${activity}`
  const totals = new Map<string, number>(); // leaderId -> antall tildelinger totalt
  history.forEach((row) => {
    const key = `${row.leader_id}|${row.activity}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    totals.set(row.leader_id, (totals.get(row.leader_id) ?? 0) + 1);
  });

  const can = (c: ActivityCandidate, activity: string) =>
    !activityRequiresCompetence(activity) ||
    c.competencies.length === 0 ||
    c.competencies.includes(activity);

  const result: GeneratedActivity[] = [];
  const taken = new Set<string>(); // ledere som allerede har fått i denne runden

  // Aktiviteter med færrest kvalifiserte ledere fordeles først (vanskeligst å dekke).
  // På ankomst kreves ikke kompetanse, så vi sorterer ikke etter kvalifiserte.
  const ordered = requireCompetence
    ? [...activities].sort(
        (a, b) =>
          candidates.filter((c) => can(c, a)).length - candidates.filter((c) => can(c, b)).length,
      )
    : [...activities];

  for (const activity of ordered) {
    const pool = candidates.filter((c) => !taken.has(c.leaderId));
    if (pool.length === 0) break;

    const qualified = requireCompetence ? pool.filter((c) => can(c, activity)) : [];
    const usePool = requireCompetence && qualified.length > 0 ? qualified : pool;

    const best = [...usePool].sort((a, b) => {
      const ca = counts.get(`${a.leaderId}|${activity}`) ?? 0;
      const cb = counts.get(`${b.leaderId}|${activity}`) ?? 0;
      if (ca !== cb) return ca - cb; // færrest ganger på denne aktiviteten
      const ta = totals.get(a.leaderId) ?? 0;
      const tb = totals.get(b.leaderId) ?? 0;
      if (ta !== tb) return ta - tb; // deretter færrest aktiviteter totalt
      return a.name.localeCompare(b.name);
    })[0];

    if (!best) continue;
    taken.add(best.leaderId);
    result.push({
      leaderId: best.leaderId,
      name: best.name,
      activity,
      repeat: (counts.get(`${best.leaderId}|${activity}`) ?? 0) > 0,
      outsideCompetence:
        requireCompetence &&
        activityRequiresCompetence(activity) &&
        best.competencies.length > 0 &&
        !best.competencies.includes(activity),
    });
  }

  return result;
}
