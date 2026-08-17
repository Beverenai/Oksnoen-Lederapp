/**
 * Automatisk fordeling av aktiviteter for en hel leirskoleuke.
 *
 * Regler (i prioritert rekkefølge):
 *  1. lederen må ha kompetansen for aktiviteten
 *  2. lederen må ha vakt i den økten
 *  3. lederen skal ikke ha hatt samme aktivitet i forrige økt
 *  4. færrest ganger med denne aktiviteten tidligere (rullering)
 *  5. jevn fordeling av totalt antall aktiviteter
 */

export interface AutoStaff {
  leaderId: string;
  name: string;
  /** Registrert kompetanse. Tom liste = ingen registrert (kan alt, men markeres). */
  competencies: string[];
}

export interface AutoSlotInput {
  date: string;
  session: string;
  /** Aktivitetene fra ukeplanleggeren for denne dagen + økten. */
  activities: string[];
  /** Ledere (leader_id) som har vakt i denne økten. */
  onDuty: string[];
  /** Ankomst/avreise: ankomst krever ikke kompetanse (alle på vakt kan ta alt). */
  requireCompetence?: boolean;
}

export interface AutoAssignmentRow {
  date: string;
  session: string;
  activity: string;
  leaderId: string;
  name: string;
  /** lederen har ingen registrert kompetanse på aktiviteten */
  outsideCompetence: boolean;
  /** lederen har hatt aktiviteten før */
  repeat: boolean;
}

export interface AutoGapRow {
  date: string;
  session: string;
  activity: string;
  reason: string;
}

export interface AutoAssignResult {
  assignments: AutoAssignmentRow[];
  gaps: AutoGapRow[];
}

const SESSION_ORDER = ['formiddag', 'ettermiddag', 'kveld'];

const sessionRank = (s: string) => {
  const i = SESSION_ORDER.indexOf(s);
  return i === -1 ? 99 : i;
};

const canDo = (staff: AutoStaff, activity: string) =>
  staff.competencies.length === 0 || staff.competencies.includes(activity);

export function autoAssignWeek({
  slots,
  staff,
  manual = [],
  history = [],
}: {
  slots: AutoSlotInput[];
  staff: AutoStaff[];
  /** Manuelt satte tildelinger som skal beholdes. */
  manual?: { date: string; session: string; activity: string; leader_id: string }[];
  /** Historikk fra alle uker, for rullering. */
  history?: { leader_id: string; activity: string }[];
}): AutoAssignResult {
  const byId = new Map(staff.map((s) => [s.leaderId, s]));

  const counts = new Map<string, number>(); // `${leaderId}|${activity}`
  const totals = new Map<string, number>();
  history.forEach((h) => {
    counts.set(`${h.leader_id}|${h.activity}`, (counts.get(`${h.leader_id}|${h.activity}`) ?? 0) + 1);
    totals.set(h.leader_id, (totals.get(h.leader_id) ?? 0) + 1);
  });

  /** Hva lederen hadde i forrige økt vi behandlet. */
  const previous = new Map<string, string>();

  const ordered = [...slots].sort(
    (a, b) => a.date.localeCompare(b.date) || sessionRank(a.session) - sessionRank(b.session),
  );

  const assignments: AutoAssignmentRow[] = [];
  const gaps: AutoGapRow[] = [];

  for (const slot of ordered) {
    if (!slot.activities.length) continue;

    const manualHere = manual.filter((m) => m.date === slot.date && m.session === slot.session);
    const busy = new Set(manualHere.map((m) => m.leader_id));
    const covered = new Set(manualHere.map((m) => m.activity));
    const nextPrevious = new Map<string, string>();

    manualHere.forEach((m) => {
      counts.set(`${m.leader_id}|${m.activity}`, (counts.get(`${m.leader_id}|${m.activity}`) ?? 0) + 1);
      totals.set(m.leader_id, (totals.get(m.leader_id) ?? 0) + 1);
      nextPrevious.set(m.leader_id, m.activity);
    });

    const dutyStaff = slot.onDuty.map((id) => byId.get(id)).filter(Boolean) as AutoStaff[];

    // Vanskeligste aktiviteter først (færrest kvalifiserte ledere på vakt).
    const todo = slot.activities
      .filter((a) => !covered.has(a))
      .sort(
        (a, b) =>
          dutyStaff.filter((s) => canDo(s, a)).length - dutyStaff.filter((s) => canDo(s, b)).length,
      );

    for (const activity of todo) {
      const free = dutyStaff.filter((s) => !busy.has(s.leaderId));
      if (free.length === 0) {
        gaps.push({
          date: slot.date,
          session: slot.session,
          activity,
          reason: 'Ingen ledige ledere på vakt i denne økten',
        });
        continue;
      }
      const qualified = free.filter((s) => canDo(s, activity));
      if (qualified.length === 0) {
        gaps.push({
          date: slot.date,
          session: slot.session,
          activity,
          reason: 'Ingen på vakt har kompetansen',
        });
        continue;
      }

      const best = [...qualified].sort((a, b) => {
        const pa = previous.get(a.leaderId) === activity ? 1 : 0;
        const pb = previous.get(b.leaderId) === activity ? 1 : 0;
        if (pa !== pb) return pa - pb; // ikke samme som forrige økt
        const ca = counts.get(`${a.leaderId}|${activity}`) ?? 0;
        const cb = counts.get(`${b.leaderId}|${activity}`) ?? 0;
        if (ca !== cb) return ca - cb; // rullering
        const ta = totals.get(a.leaderId) ?? 0;
        const tb = totals.get(b.leaderId) ?? 0;
        if (ta !== tb) return ta - tb; // jevn fordeling
        return a.name.localeCompare(b.name);
      })[0];

      busy.add(best.leaderId);
      const before = counts.get(`${best.leaderId}|${activity}`) ?? 0;
      counts.set(`${best.leaderId}|${activity}`, before + 1);
      totals.set(best.leaderId, (totals.get(best.leaderId) ?? 0) + 1);
      nextPrevious.set(best.leaderId, activity);

      assignments.push({
        date: slot.date,
        session: slot.session,
        activity,
        leaderId: best.leaderId,
        name: best.name,
        outsideCompetence: best.competencies.length > 0 && !best.competencies.includes(activity),
        repeat: before > 0,
      });
    }

    previous.clear();
    nextPrevious.forEach((v, k) => previous.set(k, v));
  }

  return { assignments, gaps };
}
