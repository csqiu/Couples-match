/**
 * Producing the list (Section 5.7) and explaining it.
 */
import { isNoMatchPair } from './candidates';
import { NRMP_RULES } from './rules';
import { stronglyConnected } from './conflicts';
import { edgeReasons, isHub, pathToLinks, shortestPath, type Graph } from './graph';
import {
  NO_MATCH,
  type Link,
  type Pair,
  type PairId,
  type PartnerIndex,
  type Pin,
  type ScoreSummary,
} from './types';

export interface RankedRow {
  rank: number;
  pair: Pair;
  score: ScoreSummary;
}

export interface RankedList {
  /** The list the couple would submit, truncated to the chosen length. */
  rows: RankedRow[];
  /** Full order of every candidate, including rows below the cut. */
  order: PairId[];
  position: Map<PairId, number>;
  length: number;
  graph: Graph;
  scores: Map<PairId, ScoreSummary>;
  /** True if unresolved cycles exist; edges inside those cycles were ignored for this order. */
  hasCycles: boolean;
}

export interface RankOptions {
  /** Requested length; clamped to [0, 300]. Defaults to the couple's setting. */
  length?: number;
}

/** Min-heap ordered by (score desc, candidate index asc). */
class PairHeap {
  private items: number[] = [];
  constructor(private key: Float64Array) {}
  get size() {
    return this.items.length;
  }
  private before(a: number, b: number) {
    return this.key[a] > this.key[b] || (this.key[a] === this.key[b] && a < b);
  }
  push(x: number) {
    const h = this.items;
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  pop(): number {
    const h = this.items;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.before(h[l], h[m])) m = l;
        if (r < h.length && this.before(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Below every real score: No Match pairs only order among themselves. */
const NO_MATCH_KEY_BASE = -1e6;

/**
 * With "No Match at the bottom", No Match pairs follow a fixed pattern instead of
 * their scores: partner 1 matching with partner 2 unmatched, in partner 1's order
 * (1–NM, 2–NM, …), then the reverse (NM–1, NM–2, …). See DECISIONS.md.
 */
function noMatchPatternKeys(g: Graph, key: Float64Array): void {
  const nm = g.pairs.filter(isNoMatchPair);
  const first = nm.filter((p) => p.programs[1] === NO_MATCH).sort((a, b) => a.rank[0] - b.rank[0] || a.index - b.index);
  const second = nm.filter((p) => p.programs[0] === NO_MATCH).sort((a, b) => a.rank[1] - b.rank[1] || a.index - b.index);
  [...first, ...second].forEach((p, i) => (key[g.index.get(p.id)!] = NO_MATCH_KEY_BASE - i));
}

/**
 * Kahn's algorithm: among pairs with no remaining predecessors, emit the one with the
 * highest key. Edges inside an unresolved cycle, and drag edges of a later stage, are skipped.
 */
function kahn(g: Graph, key: Float64Array, skip: (u: number, v: number) => boolean): number[] {
  const indeg = new Int32Array(g.size);
  for (let u = 0; u < g.size; u++) for (const v of g.out[u]) if (!skip(u, v)) indeg[v]++;
  const heap = new PairHeap(key);
  for (let i = 0; i < g.size; i++) if (indeg[i] === 0) heap.push(i);
  const order: number[] = [];
  while (heap.size) {
    const u = heap.pop();
    if (!isHub(g, u)) order.push(u);
    for (const v of g.out[u]) {
      if (skip(u, v)) continue;
      if (--indeg[v] === 0) heap.push(v);
    }
  }
  return order;
}

/**
 * Produces the list: first by score (Kahn's algorithm on the constraint graph, highest
 * posterior mean first), then each manual drag replayed on the list as it stood before
 * it, so the moved pair lands where it was dropped:
 *  - dragged up above a target: it takes the target's place, and the rows in between
 *    move down one (anything that must stay above it comes along);
 *  - dragged down below a target: it lands just under it, and the rows in between move up.
 * A pin alone would only say "above" and leave the pair behind everything that scores
 * higher. Edges inside an unresolved cycle are ignored so a list can still be shown
 * while the couple resolves it.
 */
export function rankPairs(g: Graph, scores: Map<PairId, ScoreSummary>, opts: RankOptions = {}): RankedList {
  const { compOf, comps } = stronglyConnected(g);
  const cyclic = comps.some((c) => c.length > 1);
  const ignore = (u: number, v: number) => cyclic && compOf[u] === compOf[v];

  // Hubs get +Infinity so they are released as soon as all their tops are placed.
  const key = new Float64Array(g.size).fill(Infinity);
  g.pairs.forEach((p, i) => (key[i] = scores.get(p.id)?.mean ?? 0));
  if (g.settings.noMatchAtBottom) noMatchPatternKeys(g, key);

  let stage = -1;
  const skip = (u: number, v: number) => ignore(u, v) || (g.dragStage.get(u * g.size + v) ?? -1) > stage;
  let order = kahn(g, key, skip);

  for (let k = 0; k < g.drags.length; k++) {
    stage = k;
    // Keys that reproduce the current order exactly; the drag then changes only what it must.
    order.forEach((u, pos) => (key[u] = -pos));
    const d = g.drags[k];
    if (d.moved === 'higher') {
      const top = key[d.lower] + 0.5;
      if (key[d.higher] < top) {
        key[d.higher] = top;
        // Pairs that must stay above the moved one come along, keeping their own order.
        const seen = new Uint8Array(g.size);
        const queue = [d.higher];
        seen[d.higher] = 1;
        for (let i = 0; i < queue.length; i++) {
          const v = queue[i];
          for (const u of g.in[v]) {
            if (seen[u] || skip(u, v)) continue;
            seen[u] = 1;
            queue.push(u);
            if (!isHub(g, u) && key[u] < top) key[u] = top + 0.25 + key[u] * 1e-6;
          }
        }
      }
    }
    order = kahn(g, key, skip);
  }

  const cap = NRMP_RULES.maxRanksPerPartner;
  const requested = opts.length ?? g.settings.listLength;
  const length = Math.max(0, Math.min(cap, Math.floor(requested), order.length));

  const orderIds = order.map((i) => g.pairs[i].id);
  return {
    rows: order.slice(0, length).map((i, r) => ({
      rank: r + 1,
      pair: g.pairs[i],
      score: scores.get(g.pairs[i].id) ?? { mean: 0, sd: 0 },
    })),
    order: orderIds,
    position: new Map(orderIds.map((id, i) => [id, i])),
    length,
    graph: g,
    scores,
    hasCycles: cyclic,
  };
}

export type Reason =
  | { kind: 'constraint'; links: Link[] }
  | {
      kind: 'score';
      higher: PairId;
      lower: PairId;
      higherScore: ScoreSummary;
      lowerScore: ScoreSummary;
    }
  | { kind: 'blocked_by'; pair: PairId; links: Link[]; then: Reason[] };

/**
 * "Why is X above Y?" Returns the chain of hard constraints if there is one;
 * otherwise the score comparison; or, if Y scores higher but is held down by a
 * constraint, the pair holding it down and why that pair is below X.
 */
export function explainOrder(list: RankedList, x: PairId, y: PairId, depth = 0): Reason[] {
  const g = list.graph;
  let hi = x;
  let lo = y;
  if ((list.position.get(x) ?? Infinity) > (list.position.get(y) ?? Infinity)) [hi, lo] = [y, x];
  const ih = g.index.get(hi);
  const il = g.index.get(lo);
  if (ih === undefined || il === undefined || ih === il) return [];

  const { compOf, comps } = stronglyConnected(g);
  const cyclic = comps.some((c) => c.length > 1);
  const skip = cyclic ? (u: number, v: number) => compOf[u] === compOf[v] : undefined;

  const path = shortestPath(g, ih, il, skip);
  if (path) return [{ kind: 'constraint', links: pathToLinks(g, path) }];

  const sh = list.scores.get(hi) ?? { mean: 0, sd: 0 };
  const sl = list.scores.get(lo) ?? { mean: 0, sd: 0 };
  const scoreReason: Reason = { kind: 'score', higher: hi, lower: lo, higherScore: sh, lowerScore: sl };
  if (sh.mean >= sl.mean || depth >= 3) return [scoreReason];

  // `lo` scores higher but came out later: some ancestor of `lo` was ranked below `hi`.
  const posHi = list.position.get(hi)!;
  const prev = new Int32Array(g.size).fill(-1);
  prev[il] = il;
  const queue = [il];
  for (let qi = 0; qi < queue.length; qi++) {
    const v = queue[qi];
    for (const u of g.in[v]) {
      if (prev[u] !== -1 || (skip && skip(u, v))) continue;
      prev[u] = v;
      if (!isHub(g, u) && (list.position.get(g.pairs[u].id) ?? -1) > posHi) {
        const chain = [u];
        let c = u;
        while (c !== il) chain.push((c = prev[c]));
        const blocker = g.pairs[u].id;
        return [
          {
            kind: 'blocked_by',
            pair: blocker,
            links: pathToLinks(g, chain),
            then: explainOrder(list, hi, blocker, depth + 1),
          },
        ];
      }
      queue.push(u);
    }
  }
  return [scoreReason];
}

export type MoveCheck =
  | { ok: true; pin: Pin }
  | { ok: false; blocking: Link[] };

/**
 * The couple wants `moving` above `target`. Allowed → a manual_drag pin to save.
 * `moved` says which of the two they dragged: 'higher' (`moving` dragged up above
 * `target`) or 'lower' (`target` dragged down below `moving`).
 * Blocked by a hard edge → the chain of reasons, so the UI can offer
 * "override with exception" (breakLink on one of the links) or cancel.
 */
export function proposeMove(list: RankedList, moving: PairId, target: PairId, moved: 'higher' | 'lower' = 'higher'): MoveCheck {
  const g = list.graph;
  const im = g.index.get(moving);
  const it = g.index.get(target);
  if (im === undefined || it === undefined) throw new Error('Unknown pair');
  const path = shortestPath(g, it, im);
  if (path) return { ok: false, blocking: pathToLinks(g, path) };
  return { ok: true, pin: { higher: moving, lower: target, source: 'manual_drag', moved } };
}

export interface Inversion {
  partner: PartnerIndex;
  /** Row (1-based) where the partner gets a program they ranked lower... */
  rank: number;
  pair: PairId;
  /** ...even though this program they ranked higher only shows up later. */
  betterProgram: string;
  betterProgramFirstRank: number;
  betterPair: PairId;
  /** What the couple gains at `rank` compared with `betterPair`. */
  because: Array<'closer' | 'partner_program'>;
}

/**
 * "Here is what you are trading": for each partner, rows where the couple list
 * gives them a program while a program they ranked higher only appears further
 * down — and why (closer together, or a better program for the other partner).
 */
export function inversionReport(list: RankedList, maxPerPartner = 50): Inversion[] {
  const out: Inversion[] = [];
  const rows = list.rows;
  for (const k of [0, 1] as const) {
    const o = (1 - k) as PartnerIndex;
    // For each program, the first row where partner k gets it.
    const firstRow = new Map<string, number>();
    rows.forEach((r, i) => {
      const prog = r.pair.programs[k];
      if (!firstRow.has(prog)) firstRow.set(prog, i);
    });
    let count = 0;
    for (let i = 0; i < rows.length && count < maxPerPartner; i++) {
      const row = rows[i];
      if (row.pair.programs[k] === NO_MATCH) continue;
      // Best-ranked program for partner k whose first appearance is below this row.
      let best: RankedRow | null = null;
      for (const [prog, j] of firstRow) {
        if (j <= i || prog === NO_MATCH) continue;
        const cand = rows[j];
        if (cand.pair.rank[k] < row.pair.rank[k] && (!best || cand.pair.rank[k] < best.pair.rank[k])) best = cand;
      }
      if (!best) continue;
      const because: Inversion['because'] = [];
      const bandRank = { together: 0, commutable: 1, drivable: 2, apart: 3, no_match: 4 } as const;
      if (bandRank[row.pair.band] < bandRank[best.pair.band]) because.push('closer');
      if (row.pair.rank[o] < best.pair.rank[o]) because.push('partner_program');
      out.push({
        partner: k,
        rank: row.rank,
        pair: row.pair.id,
        betterProgram: best.pair.programs[k],
        betterProgramFirstRank: best.rank,
        betterPair: best.pair.id,
        because,
      });
      count++;
    }
  }
  return out;
}

/** Every hard edge the list violates (should be empty unless cycles are unresolved). */
export function violatedEdges(list: RankedList): Link[] {
  const g = list.graph;
  const bad: Link[] = [];
  const check = (u: number, v: number, reasons: Link['reasons']) => {
    if (list.position.get(g.pairs[u].id)! > list.position.get(g.pairs[v].id)!) {
      bad.push({ from: g.pairs[u].id, to: g.pairs[v].id, reasons });
    }
  };
  for (let u = 0; u < g.n; u++) {
    for (const v of g.out[u]) {
      if (isHub(g, v)) for (const w of g.out[v]) check(u, w, [g.hubs[v - g.n].reason]);
      else check(u, v, edgeReasons(g, u, v) ?? []);
    }
  }
  return bad;
}
