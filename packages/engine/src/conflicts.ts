/**
 * Conflict ("paradox") detection (Section 5.5).
 */
import { SURPRISE_THRESHOLD } from './defaults';
import { pairFeatures } from './features';
import { posteriorMoments, predictiveExact } from './posterior';
import { pathToLinks, type Graph } from './graph';
import { effectiveComparisons, unorderedKey } from './answers';
import type { Comparison, EngineInput, Link, PairId, Posterior, RuleException } from './types';

export { effectiveComparisons };

export type Conflict =
  | { kind: 'cycle'; id: string; links: Link[] }
  | { kind: 'tier_a_collision'; id: string; partner1Example: PairId; partner2Example: PairId }
  | { kind: 'surprising_answer'; id: string; comparison: Comparison; predictedOtherWay: number }
  | { kind: 'disagreement'; id: string; comparisons: Comparison[] };

/** Strongly connected components (Tarjan, iterative). Cached on the graph. */
export function stronglyConnected(g: Graph): { compOf: Int32Array; comps: number[][] } {
  if (g._scc) return g._scc;
  const n = g.size;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const compOf = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  const comps: number[][] = [];
  let counter = 0;

  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    const work: Array<[number, number]> = [[root, 0]];
    index[root] = low[root] = counter++;
    stack.push(root);
    onStack[root] = 1;

    while (work.length) {
      const frame = work[work.length - 1];
      const v = frame[0];
      const edges = g.out[v];
      if (frame[1] < edges.length) {
        const w = edges[frame[1]++];
        if (index[w] === -1) {
          index[w] = low[w] = counter++;
          stack.push(w);
          onStack[w] = 1;
          work.push([w, 0]);
        } else if (onStack[w]) {
          low[v] = Math.min(low[v], index[w]);
        }
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1][0];
          low[parent] = Math.min(low[parent], low[v]);
        }
        if (low[v] === index[v]) {
          const comp: number[] = [];
          let w: number;
          do {
            w = stack.pop()!;
            onStack[w] = 0;
            compOf[w] = comps.length;
            comp.push(w);
          } while (w !== v);
          comps.push(comp.sort((a, b) => a - b));
        }
      }
    }
  }
  g._scc = { compOf, comps };
  return g._scc;
}

export function hasCycles(g: Graph): boolean {
  return stronglyConnected(g).comps.some((c) => c.length > 1);
}

/** Shortest cycle inside one strongly connected component, as a list of node indices (first node not repeated). */
export function shortestCycleIn(g: Graph, comp: number[]): number[] {
  const { compOf } = stronglyConnected(g);
  const cid = compOf[comp[0]];
  let best: number[] | null = null;
  const prev = new Int32Array(g.size);
  const dist = new Int32Array(g.size);

  for (const s of comp) {
    prev.fill(-1);
    dist.fill(-1);
    dist[s] = 0;
    const queue = [s];
    let closing = -1;
    search: for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      if (best && dist[u] + 1 >= best.length) break;
      for (const v of g.out[u]) {
        if (compOf[v] !== cid) continue;
        if (v === s) {
          closing = u;
          break search;
        }
        if (dist[v] !== -1) continue;
        dist[v] = dist[u] + 1;
        prev[v] = u;
        queue.push(v);
      }
    }
    if (closing === -1) continue;
    const cycle = [closing];
    let c = closing;
    while (c !== s) cycle.push((c = prev[c]));
    cycle.reverse();
    if (!best || cycle.length < best.length) best = cycle;
    if (best.length === 2) break;
  }
  return best ?? [];
}

/** Each cycle as a chain of links (with reasons). */
export function findCycles(g: Graph): Link[][] {
  const { comps } = stronglyConnected(g);
  const out: Link[][] = [];
  for (const comp of comps) {
    if (comp.length < 2) continue;
    const cycle = shortestCycleIn(g, comp);
    out.push(pathToLinks(g, cycle, true));
  }
  return out;
}

/** Probability (under the posterior predictive) that the couple prefers `a` to `b`. */
export function preferenceProbability(g: Graph, posterior: Posterior, a: PairId, b: PairId): number {
  const ia = g.index.get(a);
  const ib = g.index.get(b);
  if (ia === undefined || ib === undefined) return 0.5;
  const fa = pairFeatures(g.pairs[ia], g.settings, posterior.layout);
  const fb = pairFeatures(g.pairs[ib], g.settings, posterior.layout);
  const x = fa.phi.map((v, i) => v - fb.phi[i]);
  return predictiveExact(posteriorMoments(posterior), x, fa.bonus - fb.bonus);
}

export function findConflicts(g: Graph, posterior: Posterior, comparisons: Comparison[]): Conflict[] {
  const conflicts: Conflict[] = [];

  if (g.tierACollision && g.settings.tierAPriority === null) {
    conflicts.push({ kind: 'tier_a_collision', id: 'tier_a_collision', ...g.tierACollision });
  }

  for (const links of findCycles(g)) {
    const ids = links.map((l) => l.from).sort();
    conflicts.push({ kind: 'cycle', id: `cycle:${ids.join(',')}`, links });
  }

  const { counted, disagreements } = effectiveComparisons(comparisons);
  for (const c of counted) {
    // Ties can't be surprising; locked answers were confirmed ("Still true? Yes"), so don't ask again.
    if (c.winner === 'tie' || c.locked) continue;
    const [won, lost] = c.winner === 'left' ? [c.left, c.right] : [c.right, c.left];
    if (!g.index.has(won) || !g.index.has(lost)) continue;
    const pOther = 1 - preferenceProbability(g, posterior, won, lost);
    if (pOther > SURPRISE_THRESHOLD) {
      conflicts.push({ kind: 'surprising_answer', id: `surprise:${c.id}`, comparison: c, predictedOtherWay: pOther });
    }
  }

  for (const d of disagreements) {
    conflicts.push({ kind: 'disagreement', id: `disagree:${unorderedKey(d[0].left, d[0].right)}`, comparisons: d });
  }
  return conflicts;
}

/**
 * Applies the couple's choice of which link in a cycle to break.
 * Breaking a pin deletes it; breaking a rule edge creates an exception scoped to those two pairs.
 */
export function breakLink(input: EngineInput, link: Link): EngineInput {
  const isPin = link.reasons.some((r) => r.kind === 'pin');
  const isRule = link.reasons.some((r) => r.kind !== 'pin');
  const pins = isPin ? input.pins.filter((p) => !(p.higher === link.from && p.lower === link.to)) : input.pins;
  const exceptions: RuleException[] = isRule
    ? [...input.exceptions, { higher: link.from, lower: link.to }]
    : input.exceptions;
  return { ...input, pins, exceptions };
}
