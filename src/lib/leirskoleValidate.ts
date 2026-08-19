/**
 * Én felles regelmotor for leirskole-ukeplanen. Brukes av varselpanelet i
 * ukebordet, av redigeringspanelet for én rute og av forhåndsvisningen før
 * generering — slik at alle stedene sier akkurat det samme.
 */

export type LeirskoleIssueType =
  | 'missing_leader'
  | 'over_hours'
  | 'short_rest'
  | 'double_booked'
  | 'unstaffed';

export interface LeirskoleIssue {
  type: LeirskoleIssueType;
  date: string;
  /** formiddag | ettermiddag | kveld | postId — null for rader uten rute. */
  session?: string | null;
  rowIndex?: number | null;
  /** Kort etikett, f.eks. «Økt 2» eller «Frokost». */
  label: string;
  message: string;
  leaderId?: string;
}

export interface ValidatePost {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  crosses_midnight?: boolean | null;
  is_night?: boolean | null;
  /** Leder-id-er (ikke staff-id-er) som står på vakten. */
  leaderIds: string[];
}

export interface ValidateInput {
  dates: string[];
  posts: ValidatePost[];
  /** Dager som er ankomst/avreise — der gjelder ikke standardradene. */
  specialDates: Set<string>;
  lockedDates?: Set<string>;
  /** Kjøkkenvakt hele dagen: leder-id-er per dato. */
  kitchenByDate: Map<string, string[]>;
  kitchenHours: number;
  /** Faktiske kjøkkentimer per `${dato}|${lederId}` — brukes når det ikke er hel dag. */
  kitchenHoursByLeader?: Map<string, number>;
  maxHours: number;
  /** Minimum hvile mellom to vakter, i timer. */
  minRestHours?: number;
  leaderName: Map<string, string>;
  /** Aktiviteter i ukeplanen som ingen leder har fått. */
  missingActivities: {
    date: string;
    session: string | null;
    rowIndex: number | null;
    label: string;
    activityLabel: string;
  }[];
  /** Rader som må ha bemanning: navnene slik de står på postene. */
  requiredRows?: string[];
}

const MEAL_ROWS = ['Frokost', 'Middag', 'Kvelds', 'Sanitas', 'Nattevakt'];

const toDate = (date: string, time: string) => new Date(`${date}T${(time ?? '00:00').slice(0, 5)}:00`);

function postRange(p: ValidatePost) {
  const start = toDate(p.date, p.start_time);
  const end = toDate(p.date, p.end_time);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return { start, end };
}

const short = (name: string) => (name ?? '?').split(' ')[0];

/** Alle brudd i uken, sortert etter dato. */
export function validateLeirskoleWeek(input: ValidateInput): LeirskoleIssue[] {
  const {
    dates,
    posts,
    specialDates,
    kitchenByDate,
    kitchenHours,
    kitchenHoursByLeader,
    maxHours,
    minRestHours = 11,
    leaderName,
    missingActivities,
    requiredRows = MEAL_ROWS,
  } = input;

  const issues: LeirskoleIssue[] = [];

  // 1. Aktiviteter uten leder
  missingActivities.forEach((m) => {
    issues.push({
      type: 'missing_leader',
      date: m.date,
      session: m.session,
      rowIndex: m.rowIndex,
      label: m.label,
      message: `${m.activityLabel} mangler leder`,
    });
  });

  // 2. Timer per leder per dag (kjøkkenvakt teller som full dag)
  const hours = new Map<string, Map<string, number>>();
  const add = (date: string, leaderId: string, h: number) => {
    const day = hours.get(date) ?? new Map<string, number>();
    day.set(leaderId, (day.get(leaderId) ?? 0) + h);
    hours.set(date, day);
  };
  posts.forEach((p) => p.leaderIds.forEach((id) => add(p.date, id, Number(p.duration_hours ?? 0))));
  kitchenByDate.forEach((ids, date) =>
    ids.forEach((id) => add(date, id, kitchenHoursByLeader?.get(`${date}|${id}`) ?? kitchenHours)),
  );

  dates.forEach((date) => {
    (hours.get(date) ?? new Map()).forEach((v, leaderId) => {
      if (v > maxHours + 0.01) {
        issues.push({
          type: 'over_hours',
          date,
          session: null,
          rowIndex: null,
          label: 'Timer',
          leaderId,
          message: `${short(leaderName.get(leaderId) ?? '?')} har ${v.toFixed(1)}t (planleggingsgrense ${maxHours}t)`,
        });
      }
    });
  });

  // 3. Dobbeltbooking: to overlappende vakter, eller kjøkken + vakt samme dag
  const byLeader = new Map<string, { post: ValidatePost; start: Date; end: Date }[]>();
  posts.forEach((p) => {
    const r = postRange(p);
    p.leaderIds.forEach((id) => byLeader.set(id, [...(byLeader.get(id) ?? []), { post: p, ...r }]));
  });

  byLeader.forEach((shifts, leaderId) => {
    const sorted = [...shifts].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.start.getTime() < prev.end.getTime()) {
        issues.push({
          type: 'double_booked',
          date: cur.post.date,
          session: null,
          rowIndex: null,
          label: cur.post.name,
          leaderId,
          message: `${short(leaderName.get(leaderId) ?? '?')} er satt på både ${prev.post.name} og ${cur.post.name}`,
        });
        continue;
      }
      // 4. For kort hvile (kun mellom arbeidsdager, etter endt arbeidsdag)
      const rest = (cur.start.getTime() - prev.end.getTime()) / 3_600_000;
      if (rest < minRestHours - 0.01 && prev.post.date !== cur.post.date) {
        issues.push({
          type: 'short_rest',
          date: cur.post.date,
          session: null,
          rowIndex: null,
          label: cur.post.name,
          leaderId,
          message: `${short(leaderName.get(leaderId) ?? '?')} har bare ${rest.toFixed(1)}t hvile etter endt arbeidsdag (${prev.post.name})`,
        });
      }
    }
  });

  kitchenByDate.forEach((ids, date) => {
    ids.forEach((id) => {
      const kh = kitchenHoursByLeader?.get(`${date}|${id}`) ?? kitchenHours;
      const clash = posts.filter((p) => p.date === date && p.leaderIds.includes(id));
      if (clash.length && kh >= kitchenHours) {
        issues.push({
          type: 'double_booked',
          date,
          session: null,
          rowIndex: null,
          label: 'Kjøkken',
          leaderId: id,
          message: `${short(leaderName.get(id) ?? '?')} har kjøkken hele dagen, men står også på ${clash
            .map((p) => p.name)
            .join(', ')}`,
        });
      }
    });
  });

  // 5. Rader uten bemanning
  dates
    .filter((d) => !specialDates.has(d))
    .forEach((date) => {
      requiredRows.forEach((row) => {
        const post = posts.find(
          (p) => p.date === date && (p.name ?? '').trim().toLowerCase() === row.toLowerCase(),
        );
        if (!post) {
          issues.push({
            type: 'unstaffed',
            date,
            session: null,
            rowIndex: null,
            label: row,
            message: `${row} finnes ikke denne dagen`,
          });
        } else if (post.leaderIds.length === 0) {
          issues.push({
            type: 'unstaffed',
            date,
            session: null,
            rowIndex: null,
            label: row,
            message: `${row} har ingen ledere`,
          });
        }
      });
    });

  return issues.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export const ISSUE_LABEL: Record<LeirskoleIssueType, string> = {
  missing_leader: 'Aktiviteter uten leder',
  over_hours: 'Over dagstaket',
  short_rest: 'For kort hvile',
  double_booked: 'Dobbeltbooket',
  unstaffed: 'Mangler bemanning',
};

export function groupIssues(issues: LeirskoleIssue[]) {
  const map = new Map<LeirskoleIssueType, LeirskoleIssue[]>();
  issues.forEach((i) => map.set(i.type, [...(map.get(i.type) ?? []), i]));
  return [...map.entries()];
}
