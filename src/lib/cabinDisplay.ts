// Display form of a cabin's main (first-word) name.
const MAIN_NAME_OVERRIDES: Record<string, string> = {
  seilern: 'Seileren',
  seileren: 'Seileren',
};

export function mainCabinName(fullName: string | null | undefined): string {
  const main = (fullName || '').trim().split(/\s+/)[0] || '';
  if (!main) return '';
  return MAIN_NAME_OVERRIDES[main.toLowerCase()] ?? main;
}

/**
 * Collapse a list of cabins/rooms to unique main cabins.
 * e.g. ["Seilern Maui", "Seilern Tipi", "Hulder"] -> [{ name: "Seileren", id }, { name: "Hulder", id }]
 */
export function groupMainCabins<T extends { id?: string; name: string }>(
  cabins: T[] | undefined | null,
): { key: string; name: string; id?: string }[] {
  if (!cabins || cabins.length === 0) return [];
  const seen = new Set<string>();
  const out: { key: string; name: string; id?: string }[] = [];
  for (const c of cabins) {
    const name = mainCabinName(c.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name, id: c.id });
  }
  return out;
}

// Group cabin names by their main (first-word) name.
// e.g. ["Seilern Maui", "Seilern Tipi", "Hulder"] -> "Seilern + Hulder"
export function formatMainCabins(
  cabins: { name: string }[] | undefined | null,
  separator = ' + '
): string {
  return groupMainCabins(cabins as { name: string }[]).map(c => c.name).join(separator);
}