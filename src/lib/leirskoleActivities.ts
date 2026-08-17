import { LEIRSKOLE_COMPETENCIES } from '@/lib/leirskoleCompetencies';

/** Aktivitetene lederne kan ha ansvar for — samme sett som kompetansene. */
export const LEIRSKOLE_ACTIVITIES = LEIRSKOLE_COMPETENCIES;

export const LEIRSKOLE_SESSIONS = [
  { key: 'formiddag', label: 'Formiddag' },
  { key: 'ettermiddag', label: 'Ettermiddag' },
  { key: 'kveld', label: 'Kveld' },
] as const;

export type LeirskoleSessionKey = (typeof LEIRSKOLE_SESSIONS)[number]['key'];

export function sessionLabel(key: string) {
  return LEIRSKOLE_SESSIONS.find((s) => s.key === key)?.label ?? key;
}

/** Tidsvinduer brukt for å finne hvem som jobber i en økt. */
export const SESSION_WINDOWS: Record<string, { from: string; to: string }> = {
  formiddag: { from: '08:00', to: '13:00' },
  ettermiddag: { from: '13:00', to: '18:00' },
  kveld: { from: '18:00', to: '23:00' },
};

/** Overlapper vakten [start,end) med økten? */
export function shiftInSession(start: string, end: string, session: string) {
  const win = SESSION_WINDOWS[session];
  if (!win) return true;
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  const endAdj = e <= s ? '23:59' : e; // nattvakt
  return s < win.to && endAdj > win.from;
}

export interface RotationInput {
  /** Ledere som jobber denne økten. */
  leaders: { id: string; competencies: string[] }[];
  /** Hvor mange ganger lederen har hatt aktiviteten før (nøkkel: `${leaderId}:${activity}`). */
  history: Map<string, number>;
  /** Aktiviteter som allerede er satt manuelt denne økten (leaderId -> activity). */
  locked?: Map<string, string>;
}

/**
 * Fordeler aktiviteter rettferdig: lederen får den aktiviteten hen har hatt
 * færrest ganger før, innenfor egen kompetanse, og vi unngår at to ledere får
 * samme aktivitet i samme økt så lenge det finnes nok å gå på.
 */
export function rotateActivities({ leaders, history, locked }: RotationInput) {
  const allKeys = LEIRSKOLE_ACTIVITIES.map((a) => a.key as string);
  const result = new Map<string, string>();
  const usedThisSession = new Set<string>();

  (locked ?? new Map()).forEach((activity, leaderId) => {
    result.set(leaderId, activity);
    usedThisSession.add(activity);
  });

  const pending = leaders
    .filter((l) => !result.has(l.id))
    // mest begrensede ledere først
    .sort((a, b) => {
      const ca = a.competencies.filter((c) => allKeys.includes(c)).length || allKeys.length;
      const cb = b.competencies.filter((c) => allKeys.includes(c)).length || allKeys.length;
      return ca - cb;
    });

  for (const leader of pending) {
    const own = leader.competencies.filter((c) => allKeys.includes(c));
    const candidates = own.length ? own : allKeys;
    const best = [...candidates].sort((a, b) => {
      const dupA = usedThisSession.has(a) ? 1 : 0;
      const dupB = usedThisSession.has(b) ? 1 : 0;
      if (dupA !== dupB) return dupA - dupB;
      const ha = history.get(`${leader.id}:${a}`) ?? 0;
      const hb = history.get(`${leader.id}:${b}`) ?? 0;
      if (ha !== hb) return ha - hb;
      return a.localeCompare(b);
    })[0];
    if (!best) continue;
    result.set(leader.id, best);
    usedThisSession.add(best);
  }

  return result;
}
