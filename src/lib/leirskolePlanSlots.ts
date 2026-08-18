/**
 * Plassene i en økt kommer fra «Dag til dag»-ruten: hver aktivitet i ruten gir
 * én plass, og «Klatring x2» gir to. Aktivitetstildelingene fylles inn i
 * plassene — alt som ikke passer i planen regnes som utenfor planen.
 */
import { countActivity, stripMultiplier } from '@/lib/leirskoleCellInstances';

export interface PlanType {
  key: string;
  label: string;
  emoji: string | null;
}

export interface PlanSlot {
  /** `${key}#${slot}` — unik nøkkel. */
  id: string;
  key: string;
  label: string;
  emoji: string | null;
  slot: number;
  /** Lederen som har plassen, eller null når den står tom. */
  leaderId: string | null;
}

export interface PlanSlotResult {
  slots: PlanSlot[];
  /** Ledere med en aktivitet som ikke finnes i ruten (eller utover antallet). */
  staleLeaderIds: string[];
}

export const splitPlanLines = (content: string | null | undefined) =>
  (content ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const mentions = (line: string, label: string) =>
  stripMultiplier(line).toLowerCase().includes(label.trim().toLowerCase());

/** Plassene i ruten, i samme rekkefølge som linjene, med lederne fylt inn. */
export function planSlots(
  lines: string[],
  types: PlanType[],
  assignments: { leader_id: string; activity: string }[],
): PlanSlotResult {
  const ordered = types
    .map((t) => ({ t, index: lines.findIndex((l) => mentions(l, t.label)) }))
    .filter((x) => x.index >= 0)
    .sort((a, b) => a.index - b.index);

  const slots: PlanSlot[] = [];
  const used = new Set<string>();

  ordered.forEach(({ t }) => {
    const holders = assignments.filter((a) => a.activity === t.key);
    const count = countActivity(lines, t.label);
    for (let slot = 0; slot < count; slot += 1) {
      const holder = holders[slot];
      if (holder) used.add(holder.leader_id);
      slots.push({
        id: `${t.key}#${slot}`,
        key: t.key,
        label: t.label,
        emoji: t.emoji,
        slot,
        leaderId: holder?.leader_id ?? null,
      });
    }
  });

  const staleLeaderIds = assignments
    .filter((a) => !used.has(a.leader_id))
    .map((a) => a.leader_id);

  return { slots, staleLeaderIds: Array.from(new Set(staleLeaderIds)) };
}

/** Rad i «Dag til dag» ⇄ øktnøkkel i aktivitetstabellen. */
export const SESSION_ROWS: { row: number; label: string; session: string }[] = [
  { row: 1, label: 'Økt 1', session: 'formiddag' },
  { row: 2, label: 'Økt 2', session: 'ettermiddag' },
  { row: 3, label: 'Økt 3', session: 'kveld' },
];

export const rowForSession = (session: string) =>
  SESSION_ROWS.find((r) => r.session === session)?.row ?? null;
