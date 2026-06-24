export const GARMENT_TYPES = [
  { value: 'genser', label: 'Genser' },
  { value: 't-skjorte', label: 'T-skjorte' },
  { value: 'bukse', label: 'Bukse' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'sokk', label: 'Sokk' },
  { value: 'undertoy', label: 'Undertøy' },
  { value: 'jakke', label: 'Jakke' },
  { value: 'lue', label: 'Lue' },
  { value: 'hansker', label: 'Hansker' },
  { value: 'sko', label: 'Sko' },
  { value: 'badetoy', label: 'Badetøy' },
  { value: 'handkle', label: 'Håndkle' },
  { value: 'drikkeflaske', label: 'Drikkeflaske' },
  { value: 'briller', label: 'Briller' },
  { value: 'smykke', label: 'Smykke' },
  { value: 'elektronikk', label: 'Elektronikk' },
  { value: 'annet', label: 'Annet' },
] as const;

export const COLORS = [
  { value: 'svart', label: 'Svart', hex: '#1a1a1a' },
  { value: 'hvit', label: 'Hvit', hex: '#f5f5f5' },
  { value: 'gra', label: 'Grå', hex: '#9ca3af' },
  { value: 'rod', label: 'Rød', hex: '#dc2626' },
  { value: 'rosa', label: 'Rosa', hex: '#ec4899' },
  { value: 'oransje', label: 'Oransje', hex: '#f97316' },
  { value: 'gul', label: 'Gul', hex: '#facc15' },
  { value: 'gronn', label: 'Grønn', hex: '#16a34a' },
  { value: 'bla', label: 'Blå', hex: '#2563eb' },
  { value: 'lilla', label: 'Lilla', hex: '#7c3aed' },
  { value: 'brun', label: 'Brun', hex: '#92400e' },
  { value: 'beige', label: 'Beige', hex: '#d6c7a3' },
  { value: 'flerfarget', label: 'Flerfarget', hex: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' },
] as const;

export const garmentLabel = (v: string) =>
  GARMENT_TYPES.find(g => g.value === v)?.label ?? v;

export const colorMeta = (v: string) =>
  COLORS.find(c => c.value === v) ?? { value: v, label: v, hex: '#888' };

export const slugify = (s: string): string =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);