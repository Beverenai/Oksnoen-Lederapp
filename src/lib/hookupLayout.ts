import type { Hookup } from '@/hooks/useHookups';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  deg: number;
}

export const LAYOUT_SIZE = 1000;

/**
 * Small deterministic force-directed layout for the Klineliste map.
 *
 * Runs a fixed number of iterations synchronously (cheap for a few hundred
 * nodes) so the result can be memoised instead of animated. Connected people
 * end up clustered, isolated pairs drift to the edges.
 */
export function computeHookupLayout(
  ids: string[],
  hookups: Hookup[],
  iterations = 260,
): LayoutNode[] {
  const n = ids.length;
  if (n === 0) return [];

  const index = new Map(ids.map((id, i) => [id, i]));
  const deg = new Array(n).fill(0);
  const edges: Array<[number, number]> = [];
  for (const h of hookups) {
    const a = index.get(h.leader_a_id);
    const b = index.get(h.leader_b_id);
    if (a === undefined || b === undefined || a === b) continue;
    edges.push([a, b]);
    deg[a]++;
    deg[b]++;
  }

  // Deterministic pseudo-random start on a spiral (no Math.random, so the
  // map does not jump around between renders).
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const center = LAYOUT_SIZE / 2;
  for (let i = 0; i < n; i++) {
    const angle = i * 2.399963; // golden angle
    const radius = (LAYOUT_SIZE * 0.42) * Math.sqrt((i + 0.5) / n);
    xs[i] = center + Math.cos(angle) * radius;
    ys[i] = center + Math.sin(angle) * radius;
  }

  const area = LAYOUT_SIZE * LAYOUT_SIZE;
  const k = Math.sqrt(area / n); // ideal distance
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);

  for (let step = 0; step < iterations; step++) {
    const temp = (1 - step / iterations) * (LAYOUT_SIZE * 0.06) + 0.5;
    fx.fill(0);
    fy.fill(0);

    // Repulsion (O(n^2); fine up to a few hundred leaders).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[i] - xs[j];
        let dy = ys[i] - ys[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = ((i - j) % 2 === 0 ? 1 : -1) * 0.7;
          dy = 0.7;
          d2 = 1;
        }
        const rep = (k * k) / d2;
        const d = Math.sqrt(d2);
        const ux = (dx / d) * rep;
        const uy = (dy / d) * rep;
        fx[i] += ux;
        fy[i] += uy;
        fx[j] -= ux;
        fy[j] -= uy;
      }
    }

    // Attraction along edges.
    for (const [a, b] of edges) {
      const dx = xs[a] - xs[b];
      const dy = ys[a] - ys[b];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const att = (d * d) / k / 6;
      const ux = (dx / d) * att;
      const uy = (dy / d) * att;
      fx[a] -= ux;
      fy[a] -= uy;
      fx[b] += ux;
      fy[b] += uy;
    }

    // Weak pull to the centre keeps disconnected clusters on screen.
    for (let i = 0; i < n; i++) {
      fx[i] += (center - xs[i]) * 0.012;
      fy[i] += (center - ys[i]) * 0.012;

      const d = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) || 0.001;
      const limit = Math.min(d, temp);
      xs[i] += (fx[i] / d) * limit;
      ys[i] += (fy[i] / d) * limit;
    }
  }

  // Normalise into the layout box with a margin.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }
  const margin = 70;
  const span = LAYOUT_SIZE - margin * 2;
  const sx = maxX - minX > 1 ? span / (maxX - minX) : 1;
  const sy = maxY - minY > 1 ? span / (maxY - minY) : 1;
  const s = Math.min(sx, sy);

  return ids.map((id, i) => ({
    id,
    deg: deg[i],
    x: margin + (xs[i] - minX) * s + (span - (maxX - minX) * s) / 2,
    y: margin + (ys[i] - minY) * s + (span - (maxY - minY) * s) / 2,
  }));
}

/** Ids within `depth` steps of `startId` (used for "Mitt nett"). */
export function neighbourhood(startId: string, hookups: Hookup[], depth = 2): Set<string> {
  const adj = new Map<string, string[]>();
  const push = (a: string, b: string) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  hookups.forEach((h) => {
    push(h.leader_a_id, h.leader_b_id);
    push(h.leader_b_id, h.leader_a_id);
  });

  const seen = new Set([startId]);
  let frontier = [startId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const other of adj.get(id) ?? []) {
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return seen;
}