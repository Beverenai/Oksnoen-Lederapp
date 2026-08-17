/**
 * Tilfeldig, rulleringsbevisst utfylling av ukeplanen (økt 1–3 per dag).
 *
 * Reglene:
 *  - kun tomme ruter fylles (med mindre `overwrite` er satt)
 *  - samme aktivitet gjentas ikke i to økter på rad
 *  - alle aktiviteter brukes like mange ganger (trekkes fra en stokket pott)
 */

export interface RandomPlanActivity {
  key: string;
  label: string;
  emoji: string | null;
}

export interface RandomPlanCell {
  date: string;
  rowIndex: number;
  content: string;
}

const ROWS = [1, 2, 3];

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const activityLine = (a: RandomPlanActivity) => `${a.emoji ?? ''} ${a.label}`.trim();

export function randomWeekPlan({
  dates,
  activities,
  perSession = 6,
  filled = new Set<string>(),
  overwrite = false,
}: {
  /** Datoene som skal fylles (vanlige dager — ikke ankomst/avreise). */
  dates: string[];
  activities: RandomPlanActivity[];
  perSession?: number;
  /** `${date}|${rowIndex}` for ruter som allerede har innhold. */
  filled?: Set<string>;
  overwrite?: boolean;
}): RandomPlanCell[] {
  if (!activities.length || !dates.length) return [];

  const size = Math.max(1, Math.min(perSession, activities.length));
  const out: RandomPlanCell[] = [];
  let pool: RandomPlanActivity[] = [];
  let previous: string[] = [];

  const draw = (avoid: Set<string>, taken: Set<string>): RandomPlanActivity | null => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const relaxed = attempt === 1;
      const idx = pool.findIndex(
        (a) => !taken.has(a.key) && (relaxed || !avoid.has(a.key)),
      );
      if (idx !== -1) return pool.splice(idx, 1)[0];
      if (pool.length === 0) {
        pool = shuffle(activities);
        attempt -= 1; // prøv samme runde igjen med ny pott
        if (pool.length === 0) return null;
      }
    }
    return null;
  };

  for (const date of dates) {
    for (const rowIndex of ROWS) {
      const key = `${date}|${rowIndex}`;
      if (!overwrite && filled.has(key)) {
        previous = [];
        continue;
      }
      if (pool.length < size) pool = [...pool, ...shuffle(activities)];

      const avoid = new Set(previous);
      const taken = new Set<string>();
      const picked: RandomPlanActivity[] = [];
      for (let i = 0; i < size; i += 1) {
        const next = draw(avoid, taken);
        if (!next) break;
        taken.add(next.key);
        picked.push(next);
      }
      if (!picked.length) continue;

      previous = picked.map((a) => a.key);
      out.push({ date, rowIndex, content: picked.map(activityLine).join('\n') });
    }
  }

  return out;
}
