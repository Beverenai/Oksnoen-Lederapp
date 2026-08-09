/**
 * Taggeing av ledere i Lederhuset-chatten.
 *
 * Meldinger lagres som ren tekst med "@Fornavn Etternavn" slik brukeren skrev
 * det. Ved sending matcher vi teksten mot lederlisten (lengste navn først, så
 * "@Anne Lise" ikke matcher bare "Anne"), og lagrer id-ene i chat_messages.mentions.
 * Ved visning splitter vi teksten på de samme navnene, så gamle meldinger uten
 * mentions-kolonne også får riktig markering.
 */

export interface MentionLeader {
  id: string;
  name: string;
}

function byLongestName<T extends MentionLeader>(leaders: T[]) {
  return [...leaders].sort((a, b) => b.name.length - a.name.length);
}

/** Ledere som er nevnt med "@Navn" i teksten. */
export function findMentionedLeaders<T extends MentionLeader>(text: string, leaders: T[]): T[] {
  const lower = text.toLowerCase();
  const hits: T[] = [];
  for (const l of byLongestName(leaders)) {
    const needle = `@${l.name.toLowerCase()}`;
    if (lower.includes(needle)) hits.push(l);
  }
  return hits;
}

export type MentionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; leaderId: string };

/** Deler meldingsteksten i vanlig tekst og @-taggede navn. */
export function splitMentionSegments<T extends MentionLeader>(
  text: string,
  leaders: T[],
): MentionSegment[] {
  const candidates = byLongestName(leaders);
  const out: MentionSegment[] = [];
  let buffer = '';
  let i = 0;

  while (i < text.length) {
    if (text[i] === '@') {
      const rest = text.slice(i + 1).toLowerCase();
      const hit = candidates.find((l) => rest.startsWith(l.name.toLowerCase()));
      if (hit) {
        if (buffer) {
          out.push({ type: 'text', text: buffer });
          buffer = '';
        }
        out.push({
          type: 'mention',
          text: `@${text.slice(i + 1, i + 1 + hit.name.length)}`,
          leaderId: hit.id,
        });
        i += 1 + hit.name.length;
        continue;
      }
    }
    buffer += text[i];
    i++;
  }
  if (buffer) out.push({ type: 'text', text: buffer });
  return out;
}

/**
 * Aktiv "@..."-søkefrase rett før markøren, eller null når brukeren ikke er
 * midt i en tagging. Vi tillater ett mellomrom slik at etternavn kan søkes.
 */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/[\s(]/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.includes('\n')) return null;
  if (query.split(' ').length > 2) return null;
  return { start: at, query };
}

/** Setter inn "@Navn " på plassen til den aktive søkefrasen. */
export function applyMention(
  text: string,
  caret: number,
  start: number,
  name: string,
): { text: string; caret: number } {
  const insert = `@${name} `;
  const next = text.slice(0, start) + insert + text.slice(caret);
  return { text: next, caret: start + insert.length };
}