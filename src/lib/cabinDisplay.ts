// Group cabin names by their main (first-word) name.
// e.g. ["Seilern Maui", "Seilern Tipi", "Hulder"] -> "Seilern + Hulder"
export function formatMainCabins(
  cabins: { name: string }[] | undefined | null,
  separator = ' + '
): string {
  if (!cabins || cabins.length === 0) return '';
  const seen = new Set<string>();
  const mains: string[] = [];
  for (const c of cabins) {
    const main = (c.name || '').trim().split(/\s+/)[0];
    if (!main) continue;
    const key = main.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mains.push(main);
  }
  return mains.join(separator);
}