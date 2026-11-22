export interface ActivityEntry {
  id: string;
  activity: string;
  completed_at: string | null;
  source?: string | null;
  leaders?: { name: string } | null;
}

export function registrationKey(participantId: string | null, code: string, activity: string) {
  return `${participantId ?? `band:${code}`}|${activity.trim().toLowerCase()}`;
}

export class ActivityRegistration {
  sessionId = crypto.randomUUID();
  private done = new Set<string>();
  start() {
    this.sessionId = crypto.randomUUID();
    this.done.clear();
  }
  add(key: string) {
    if (this.done.has(key)) return false;
    this.done.add(key);
    return true;
  }
  undo(key: string) { this.done.delete(key); }
}

export function activityDay(timestamp: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date(timestamp));
}

export function checkInDefault(startDate: string | null | undefined, now = new Date()) {
  return !!startDate && activityDay(now.toISOString()) === startDate;
}

export function activityTimeline<T extends ActivityEntry>(entries: T[]) {
  const groups = new Map<string, T[]>();
  [...entries].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '') || b.id.localeCompare(a.id))
    .forEach(entry => {
      const day = entry.completed_at ? activityDay(entry.completed_at) : 'Ukjent dato';
      groups.set(day, [...(groups.get(day) ?? []), entry]);
    });
  return [...groups.entries()];
}

export function scanResultText(activity: string, status: string, occurrence?: number) {
  if (status === 'dobbel' || status === 'fantes') return `Allerede lagt inn på ${activity}`;
  if (status === 'gjentatt') return `${activity} · ${occurrence ?? 2}. gang`;
  if (status === 'registrert') return activity;
  return 'Skanningen er ugyldig';
}

export function manualActivityRows(ids: string[], activity: string, leaderId?: string) {
  const scan_session_id = crypto.randomUUID();
  return [...new Set(ids)].map(participant_id => ({
    participant_id, activity, registered_by: leaderId, source: 'manual', scan_session_id,
  }));
}

export function periodBounds(startDate: string, endDate: string) {
  const osloMidnight = (date: string) => {
    const midnight = new Date(`${date}T00:00:00Z`);
    const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', hourCycle: 'h23' }).format(midnight));
    return new Date(midnight.getTime() - localHour * 3600000).toISOString();
  };
  const next = new Date(`${endDate}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: osloMidnight(startDate), end: osloMidnight(next.toISOString().slice(0, 10)) };
}