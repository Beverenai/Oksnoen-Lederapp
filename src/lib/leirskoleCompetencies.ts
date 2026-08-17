export const LEIRSKOLE_COMPETENCIES = [
  { key: 'tube', label: 'Tube', emoji: '🛞' },
  { key: 'klatring', label: 'Klatring', emoji: '🧗' },
  { key: 'rappellering', label: 'Rappellering', emoji: '🪢' },
  { key: 'kanotur', label: 'Kanotur', emoji: '🛶' },
  { key: 'batkjoring', label: 'Båtkjøring', emoji: '🚤' },
  { key: 'badevakt', label: 'Badevakt', emoji: '🏊' },
] as const;

export type LeirskoleCompetenceKey = (typeof LEIRSKOLE_COMPETENCIES)[number]['key'];

export function competenceLabel(key: string) {
  return LEIRSKOLE_COMPETENCIES.find((c) => c.key === key)?.label ?? key;
}

export function competenceEmoji(key: string) {
  return LEIRSKOLE_COMPETENCIES.find((c) => c.key === key)?.emoji ?? '•';
}
