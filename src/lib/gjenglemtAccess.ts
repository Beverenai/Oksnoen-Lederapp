/**
 * Leaders (by id) who get cross-period access in Gjenglemt even without the
 * admin role, including the link to the Gjenglemt archive (/gjenglemt-admin).
 */
export const GJENGLEMT_ALL_PERIODS_LEADER_IDS: readonly string[] = [
  'eaec6422-d907-4748-8665-c9872073b1fa', // Bengt Simonsen
];

export function hasGjenglemtAllPeriodsAccess(
  leaderId: string | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  return !!leaderId && GJENGLEMT_ALL_PERIODS_LEADER_IDS.includes(leaderId);
}