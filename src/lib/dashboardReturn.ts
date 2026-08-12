const KEY = 'admin-dash-return';

/** Marker at brukeren navigerte ut fra admin-dashboardet */
export function markDashReturn() {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

export function hasDashReturn() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function clearDashReturn() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
