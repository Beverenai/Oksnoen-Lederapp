/**
 * Én rute (økt) kan ha samme aktivitet flere ganger — f.eks. to på Klatring.
 * Antallet styres av hvor mange linjer i ruteteksten som nevner aktiviteten,
 * og hver forekomst kan få sin egen leder.
 */

export interface CellType {
  key: string;
  label: string;
  emoji: string | null;
}

export interface CellInstance {
  /** `${key}#${slot}` — unik nøkkel for React. */
  id: string;
  key: string;
  label: string;
  emoji: string | null;
  /** 0-basert forekomst av denne aktiviteten i ruten. */
  slot: number;
  /** Hvor mange forekomster aktiviteten har totalt i ruten. */
  total: number;
  leaderId: string | null;
}

const mentions = (line: string, label: string) => line.toLowerCase().includes(label.trim().toLowerCase());

/** «Klatring x2» betyr to ledere på Klatring. Uten suffiks er det én. */
export const lineMultiplier = (line: string) => {
  const m = line.match(/[x×]\s*(\d{1,2})\s*$/i);
  const n = m ? Number(m[1]) : 1;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 1;
};

/** Teksten uten antall-suffiks — brukes for visning og sammenligning. */
export const stripMultiplier = (line: string) => line.replace(/\s*[x×]\s*\d{1,2}\s*$/i, '').trim();

export const countActivity = (lines: string[], label: string) =>
  lines.filter((l) => mentions(l, label)).reduce((sum, l) => sum + lineMultiplier(l), 0);

/**
 * Setter hvor mange ledere aktiviteten skal ha i ruten.
 * Alle linjer for aktiviteten slås sammen til én linje med `xN`.
 */
export function setActivityCount(lines: string[], label: string, text: string, count: number): string[] {
  const out = lines.filter((l) => !mentions(l, label));
  const n = Math.max(0, Math.min(20, Math.round(count)));
  if (n > 0) out.push(n > 1 ? `${stripMultiplier(text)} x${n}` : stripMultiplier(text));
  return out;
}

export function cellInstances(
  lines: string[],
  types: CellType[],
  assignments: { leader_id: string; activity: string }[],
): CellInstance[] {
  const order = new Map<string, number>();
  types.forEach((t) => {
    const i = lines.findIndex((l) => mentions(l, t.label));
    if (i >= 0) order.set(t.key, i);
  });

  const out: CellInstance[] = [];
  types.forEach((t) => {
    const holders = assignments.filter((a) => a.activity === t.key);
    const count = countActivity(lines, t.label);
    const total = Math.max(count, holders.length);
    for (let slot = 0; slot < total; slot += 1) {
      out.push({
        id: `${t.key}#${slot}`,
        key: t.key,
        label: t.label,
        emoji: t.emoji,
        slot,
        total,
        leaderId: holders[slot]?.leader_id ?? null,
      });
    }
  });

  return out.sort(
    (a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999) || a.slot - b.slot,
  );
}
