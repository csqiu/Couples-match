/**
 * Hard layer (Section 5.4): a directed graph over candidate pairs. An edge
 * X → Y means X must rank above Y. Every edge remembers why.
 */
import { effectiveComparisons } from './answers';
import { isNoMatchPair, pairId } from './candidates';
import { DOMINANCE_BAND_RANK } from './geo';
import {
  NO_MATCH,
  type CoupleSettings,
  type EdgeReason,
  type EngineInput,
  type Link,
  type Pair,
  type PairId,
  type PartnerIndex,
} from './types';

/**
 * A hub stands for a complete "every top above every bottom" rule (Tier A, No
 * Match at bottom): tops → hub → bottoms. That is |tops| + |bottoms| edges
 * instead of |tops| × |bottoms|. Hubs are never shown; any path through a hub
 * is reported as a direct pair-to-pair link carrying the hub's reason.
 */
export interface Hub {
  reason: EdgeReason;
}

export interface Graph {
  /** Number of real pairs. Nodes 0..n-1 are pairs; n..size-1 are hubs. */
  n: number;
  size: number;
  hubs: Hub[];
  pairs: Pair[];
  index: Map<PairId, number>;
  out: number[][];
  in: number[][];
  /** Reasons keyed by from * size + to. */
  reasons: Map<number, EdgeReason[]>;
  settings: CoupleSettings;
  /** Pins that refer to pairs that are not candidates (excluded, or a program was removed). */
  ignoredPins: number[];
  /**
   * Manual drags that say which pair was moved, in the order they were made. rank.ts
   * replays them one by one so each pair lands where it was dropped.
   */
  drags: Array<{ higher: number; lower: number; moved: 'higher' | 'lower' }>;
  /** Edges that exist only because of drags: edge key → index of the first drag that adds it. */
  dragStage: Map<number, number>;
  /** Lazily computed strongly connected components (see conflicts.ts). */
  _scc?: { compOf: Int32Array; comps: number[][] };
}

/** Upper bound on hubs: one tier rule per partner, up to 2 groups each, + No Match. */
const MAX_HUBS = 5;

function reasonKey(r: EdgeReason): string {
  return JSON.stringify(r);
}

function createGraph(pairs: Pair[], settings: CoupleSettings): Graph {
  const n = pairs.length;
  const size = n + MAX_HUBS;
  return {
    n,
    size,
    hubs: [],
    pairs,
    index: new Map(pairs.map((p, i) => [p.id, i])),
    out: Array.from({ length: size }, () => []),
    in: Array.from({ length: size }, () => []),
    reasons: new Map(),
    settings,
    ignoredPins: [],
    drags: [],
    dragStage: new Map(),
  };
}

export function addEdge(g: Graph, from: number, to: number, reason: EdgeReason): void {
  if (from === to) return;
  const key = from * g.size + to;
  const existing = g.reasons.get(key);
  if (existing) {
    const k = reasonKey(reason);
    if (!existing.some((r) => reasonKey(r) === k)) existing.push(reason);
    return;
  }
  g.reasons.set(key, [reason]);
  g.out[from].push(to);
  g.in[to].push(from);
}

export function edgeReasons(g: Graph, from: number, to: number): EdgeReason[] | undefined {
  return g.reasons.get(from * g.size + to);
}

export function isHub(g: Graph, node: number): boolean {
  return node >= g.n;
}

function newHub(g: Graph, reason: EdgeReason): number {
  if (g.hubs.length >= MAX_HUBS) throw new Error('Too many hubs');
  g.hubs.push({ reason });
  return g.n + g.hubs.length - 1;
}

/** Number of pair-to-pair constraints, counting each hub as |tops| × |bottoms|. */
export function edgeCount(g: Graph): number {
  let count = 0;
  for (let u = 0; u < g.n; u++) {
    for (const v of g.out[u]) count += isHub(g, v) ? g.out[v].length : 1;
  }
  return count;
}

/** Every reason pair u must be directly above pair v (direct edges and hubs). */
export function reasonsBetween(g: Graph, u: number, v: number): EdgeReason[] {
  const out = [...(edgeReasons(g, u, v) ?? [])];
  for (const h of g.out[u]) if (isHub(g, h) && edgeReasons(g, h, v)) out.push(g.hubs[h - g.n].reason);
  return out;
}

export function linkFor(g: Graph, from: number, to: number): Link {
  return { from: g.pairs[from].id, to: g.pairs[to].id, reasons: reasonsBetween(g, from, to) };
}

/**
 * Turns a node path (which may pass through hubs) into pair-to-pair links.
 * With `closed`, the path is a cycle and the last node links back to the first.
 */
export function pathToLinks(g: Graph, path: number[], closed = false): Link[] {
  let nodes = path;
  if (closed) {
    const start = nodes.findIndex((u) => !isHub(g, u));
    nodes = [...nodes.slice(start), ...nodes.slice(0, start), nodes[start]];
  }
  const links: Link[] = [];
  let i = 0;
  while (i + 1 < nodes.length) {
    const u = nodes[i];
    const v = nodes[i + 1];
    // A link carries every reason the first pair is directly above the second
    // (direct edge and hubs), so breaking it removes all of them at once.
    const w = isHub(g, v) ? nodes[i + 2] : v;
    links.push(linkFor(g, u, w));
    i += isHub(g, v) ? 2 : 1;
  }
  return links;
}

/** True if X dominates Y: both partners like X at least as much, one strictly more, and X is no farther apart. */
export function dominates(x: Pair, y: Pair): boolean {
  return (
    x.rank[0] <= y.rank[0] &&
    x.rank[1] <= y.rank[1] &&
    (x.rank[0] < y.rank[0] || x.rank[1] < y.rank[1]) &&
    DOMINANCE_BAND_RANK[x.band] <= DOMINANCE_BAND_RANK[y.band]
  );
}

/**
 * Dominance edges, transitively reduced: X → Y only when nothing sits strictly
 * between them. Bitsets keep this fast for several hundred pairs.
 */
function dominanceReduction(pairs: Pair[]): Array<[number, number]> {
  const n = pairs.length;
  const words = Math.ceil(n / 32);
  const dom: Uint32Array[] = new Array(n);
  for (let x = 0; x < n; x++) {
    const bits = new Uint32Array(words);
    const px = pairs[x];
    for (let y = 0; y < n; y++) {
      if (x !== y && dominates(px, pairs[y])) bits[y >>> 5] |= 1 << (y & 31);
    }
    dom[x] = bits;
  }

  const edges: Array<[number, number]> = [];
  const implied = new Uint32Array(words);
  for (let x = 0; x < n; x++) {
    implied.fill(0);
    const dx = dom[x];
    for (let w = 0; w < words; w++) {
      let word = dx[w];
      while (word) {
        const bit = word & -word;
        const z = (w << 5) + (31 - Math.clz32(bit));
        word ^= bit;
        const dz = dom[z];
        for (let v = 0; v < words; v++) implied[v] |= dz[v];
      }
    }
    for (let w = 0; w < words; w++) {
      let word = dx[w] & ~implied[w];
      while (word) {
        const bit = word & -word;
        edges.push([x, (w << 5) + (31 - Math.clz32(bit))]);
        word ^= bit;
      }
    }
  }
  return edges;
}

export function buildConstraintGraph(pairs: Pair[], input: EngineInput): Graph {
  const { settings } = input;
  const g = createGraph(pairs, settings);

  // Exceptions (rule links the couple chose to break), by the higher pair.
  const exceptedBelow = new Map<number, Set<number>>();
  for (const e of input.exceptions) {
    const x = g.index.get(e.higher);
    const y = g.index.get(e.lower);
    if (x === undefined || y === undefined) continue;
    if (!exceptedBelow.has(x)) exceptedBelow.set(x, new Set());
    exceptedBelow.get(x)!.add(y);
  }
  const excepted = (x: number, y: number) => exceptedBelow.get(x)?.has(y) ?? false;

  // 1. Dominance (automatic).
  for (const [x, y] of dominanceReduction(pairs)) {
    if (!excepted(x, y)) addEdge(g, x, y, { kind: 'dominance' });
  }

  /** Every pair in `tops` above every pair in `bottoms`, through one hub. */
  const completeRule = (tops: number[], bottoms: number[], reason: EdgeReason) => {
    if (!tops.length || !bottoms.length) return;
    const viaHub: number[] = [];
    for (const x of tops) {
      const ex = exceptedBelow.get(x);
      if (ex && bottoms.some((y) => ex.has(y))) {
        // Rare: this pair has an exception under this rule, so it gets explicit edges.
        for (const y of bottoms) if (!ex.has(y)) addEdge(g, x, y, reason);
      } else {
        viaHub.push(x);
      }
    }
    if (!viaHub.length) return;
    const hub = newHub(g, reason);
    for (const x of viaHub) addEdge(g, x, hub, reason);
    for (const y of bottoms) addEdge(g, hub, y, reason);
  };

  // 2. Tier A rule, per partner (hard mode; "strong" lives in the score): a pair that gives
  // you Tier A, while your partner matches, above every pair that doesn't. When the two
  // partners' rules point opposite ways for two pairs (X gives one of you Tier A, Y the
  // other), neither rule orders them: the score and the couple's answers ("this or that")
  // decide. A Tier C rule was tried and removed (DECISIONS.md #125–126).
  interface TierRule {
    partner: PartnerIndex;
    reason: EdgeReason;
    top: boolean[];
    bottom: boolean[];
  }
  const matched = (p: Pair, k: PartnerIndex) => p.programs[1 - k] !== NO_MATCH;
  const rules: TierRule[] = [];
  for (const k of [0, 1] as const) {
    if (settings.tierARule[k] === 'hard') {
      rules.push({
        partner: k,
        reason: { kind: 'tier_a', partner: k },
        top: pairs.map((p) => p.tier[k] === 'A' && matched(p, k)),
        bottom: pairs.map((p) => p.tier[k] !== 'A'),
      });
    }
  }

  const all = pairs.map((_, i) => i);
  for (const rule of rules) {
    const opposing = rules.filter((r) => r.partner !== rule.partner);
    const tops = all.filter((i) => rule.top[i]);
    const bottoms = all.filter((i) => rule.bottom[i]);
    // Group the tops by which of the other partner's rules put them at the bottom.
    const groups = new Map<number, number[]>();
    for (const x of tops) {
      let mask = 0;
      opposing.forEach((r, j) => r.bottom[x] && (mask |= 1 << j));
      const group = groups.get(mask);
      if (group) group.push(x);
      else groups.set(mask, [x]);
    }
    for (const [mask, group] of groups) {
      // Leave out the bottoms the other partner's rules put above this group: those clash.
      const clashing = opposing.filter((_, j) => mask & (1 << j));
      completeRule(group, clashing.length ? bottoms.filter((y) => !clashing.some((r) => r.top[y])) : bottoms, rule.reason);
    }
  }

  // 3. No Match at the bottom.
  if (settings.noMatchAtBottom) {
    completeRule(
      all.filter((i) => !isNoMatchPair(pairs[i])),
      all.filter((i) => isNoMatchPair(pairs[i])),
      { kind: 'no_match_bottom' },
    );
  }

  // 4. Answers. Every answer that counts (the latest one, or the agreed one; ties and
  // disagreements don't) holds in the list. Answers that go in a circle show up as a
  // cycle to resolve; breaking an answer's link makes an exception, and the answer
  // stays as evidence for the model.
  for (const c of effectiveComparisons(input.comparisons).counted) {
    if (c.winner === 'tie') continue;
    const [won, lost] = c.winner === 'left' ? [c.left, c.right] : [c.right, c.left];
    const x = g.index.get(won);
    const y = g.index.get(lost);
    if (x === undefined || y === undefined || x === y || excepted(x, y)) continue;
    addEdge(g, x, y, { kind: 'answer', comparisonId: c.id });
  }

  // 5. Pins.
  input.pins.forEach((pin, i) => {
    const x = g.index.get(pin.higher);
    const y = g.index.get(pin.lower);
    if (x === undefined || y === undefined || x === y) {
      g.ignoredPins.push(i);
      return;
    }
    const edge = x * g.size + y;
    const existed = g.reasons.has(edge);
    addEdge(g, x, y, {
      kind: 'pin',
      source: pin.source,
      ...(pin.id ? { pinId: pin.id } : {}),
      ...(pin.comparisonId ? { comparisonId: pin.comparisonId } : {}),
    });
    if (pin.source === 'manual_drag' && pin.moved) {
      if (!existed) g.dragStage.set(edge, g.drags.length);
      g.drags.push({ higher: x, lower: y, moved: pin.moved });
    } else {
      g.dragStage.delete(edge);
    }
  });

  return g;
}

/** Shortest node path from `from` to `to` (may pass through hubs), or null. `skip(a, b)` ignores edges. */
export function shortestPath(
  g: Graph,
  from: number,
  to: number,
  skip?: (a: number, b: number) => boolean,
): number[] | null {
  if (from === to) return [from];
  const prev = new Int32Array(g.size).fill(-1);
  prev[from] = from;
  const queue = [from];
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi];
    for (const v of g.out[u]) {
      if (prev[v] !== -1 || (skip && skip(u, v))) continue;
      prev[v] = u;
      if (v === to) {
        const path = [v];
        let c = v;
        while (c !== from) path.push((c = prev[c]));
        return path.reverse();
      }
      queue.push(v);
    }
  }
  return null;
}

export { pairId };
