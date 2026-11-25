/**
 * The comparison explorer: any two pairs, how the list orders them and why, and what
 * answering either way would do (rows that move, new conflicts). Pure, so it runs in
 * the Web Worker and in unit tests.
 */
import { shortNamed } from './pair-view';
import type { CoupleData } from '@pairwise/db';
import {
  describeConflict,
  describeExplanation,
  effectiveComparisons,
  explainOrder,
  findConflicts,
  mootWitnesses,
  pairLabel,
  preferenceProbability,
  questionKey,
  shortestPath,
} from '@pairwise/engine';
import { pairViewer, type PairView } from './analysis';
import { computeFinalList, engineFor, type FinalList } from './final-list';

export interface ExplorePair extends PairView {
  /** Rank on the final list, or null when the pair isn't on it. */
  rank: number | null;
}

export interface Impact {
  higher: string;
  lower: string;
  /** The list already has them this way round. */
  asNow: boolean;
  /** Rows of the list (up to the NRMP limit) that would change place. */
  moved: number;
  /** The biggest moves, for a preview. */
  moves: Array<{ pairId: string; label: string; from: number | null; to: number | null }>;
  /** Conflicts this answer would create (answers or rules going in a circle). */
  conflicts: string[];
}

export interface ExploreDetail {
  a: ExplorePair;
  b: ExplorePair;
  /** Which of the two the list (or, off the list, the engine) puts higher. */
  higher: 'a' | 'b';
  /** Why, in words. */
  why: string;
  /** A rule, an answer or a drag fixes this order (it isn't just the score). */
  fixed: boolean;
  /** Set when their order can never change where the couple matches. */
  moot: string | null;
  /** The answer that counts for this question, if any. */
  answer: { winner: 'a' | 'b' | 'tie'; locked: boolean } | null;
  /** The model's guess at which the couple prefers. */
  model: { prefers: 'a' | 'b'; p: number };
  /** Answering "a over b" and "b over a". */
  aOverB: Impact;
  bOverA: Impact;
}

export interface ExploreResult {
  pairs: ExplorePair[];
  detail: ExploreDetail | null;
}

export interface ExploreOptions {
  me: string;
  names: [string, string];
  a?: string | null;
  b?: string | null;
}

const PREVIEW_ID = 'explore-preview';

export function explore(data: CoupleData, opts: ExploreOptions): ExploreResult {
  const listOpts = { names: opts.names, matchType: data.couple.match_type as 'main' | 'sms_fellowship' };
  const list = computeFinalList(data, listOpts);
  const { input, result } = engineFor(data);
  const view = pairViewer(input);
  const rankOf = new Map(list.rows.map((r) => [r.pairId, r.rank]));
  const pairs: ExplorePair[] = result.list.order
    .map((id) => result.pairs.find((p) => p.id === id)!)
    .map((p) => ({ ...view(p), rank: rankOf.get(p.id) ?? null }))
    .sort((x, y) => (x.rank ?? Infinity) - (y.rank ?? Infinity));

  const pa = opts.a ? result.pairs.find((p) => p.id === opts.a) : undefined;
  const pb = opts.b ? result.pairs.find((p) => p.id === opts.b) : undefined;
  if (!pa || !pb || pa.id === pb.id) return { pairs, detail: null };

  const g = result.list.graph;
  const ra = rankOf.get(pa.id) ?? null;
  const rb = rankOf.get(pb.id) ?? null;
  const enginePos = result.list.position;
  const higher: 'a' | 'b' =
    ra !== null && rb !== null ? (ra < rb ? 'a' : 'b') : enginePos.get(pa.id)! < enginePos.get(pb.id)! ? 'a' : 'b';
  const [hi, lo] = higher === 'a' ? [pa.id, pb.id] : [pb.id, pa.id];
  // Short names ("MGH IM") keep the reasons readable in this screen's narrow cards.
  const programs = shortNamed(input.programs, input.lists);
  const ctx = { programs, partnerNames: opts.names };

  // A witness above both on the list means their order can never decide the match.
  let moot: string | null = null;
  if (ra !== null && rb !== null) {
    const top = Math.min(ra, rb);
    let best: { id: string; rank: number } | null = null;
    for (const w of mootWitnesses(pa.programs, pb.programs)) {
      const r = rankOf.get(w);
      if (r !== undefined && r < top && (!best || r < best.rank)) best = { id: w, rank: r };
    }
    if (best) moot = `#${best.rank} (${pairLabel(ctx, best.id)}) is above both, so whenever both are within reach, so is it, and the Match stops there first. Their order can never change where you match.`;
  }

  const key = questionKey(pa.id, pb.id);
  const c = effectiveComparisons(input.comparisons).counted.find((x) => questionKey(x.left, x.right) === key);
  const won = c ? (c.winner === 'tie' ? 'tie' : c.winner === 'left' ? c.left : c.right) : null;
  const pA = preferenceProbability(g, result.posterior, pa.id, pb.id);

  const base = list;
  const baseCycles = new Set(result.conflicts.filter((x) => x.kind === 'cycle').map((x) => x.id));
  const impact = (h: string, l: string): Impact => {
    const preview = withAnswer(data, opts.me, h, l);
    const next = computeFinalList(preview, listOpts);
    const run = engineFor(preview);
    const conflicts = findConflicts(run.result.graph, run.result.posterior, run.input.comparisons)
      .filter((x) => x.kind === 'cycle' && !baseCycles.has(x.id))
      .map((x) => describeConflict(ctx, x));
    return { higher: h, lower: l, asNow: h === hi, ...diff(base, next, (id) => pairLabel(ctx, id)), conflicts };
  };

  return {
    pairs,
    detail: {
      a: { ...view(pa), rank: ra },
      b: { ...view(pb), rank: rb },
      higher,
      why: describeExplanation(ctx, explainOrder(result.list, hi, lo)),
      fixed: shortestPath(g, g.index.get(hi)!, g.index.get(lo)!) !== null,
      moot,
      answer: c ? { winner: won === 'tie' ? 'tie' : won === pa.id ? 'a' : 'b', locked: !!c.locked } : null,
      model: pA >= 0.5 ? { prefers: 'a', p: pA } : { prefers: 'b', p: 1 - pA },
      aOverB: impact(pa.id, pb.id),
      bOverA: impact(pb.id, pa.id),
    },
  };
}

/** The couple's data with one more answer: `higher` over `lower`, agreed, newest. */
function withAnswer(data: CoupleData, me: string, higher: string, lower: string): CoupleData {
  return {
    ...data,
    comparisons: [
      ...data.comparisons,
      { id: PREVIEW_ID, pair_left: higher, pair_right: lower, winner: 'left', answered_by: me, both_agreed: true, locked: false, seq: Number.MAX_SAFE_INTEGER },
    ],
  };
}

function diff(before: FinalList, after: FinalList, label: (id: string) => string) {
  const was = new Map(before.rows.slice(0, before.length).map((r) => [r.pairId, r.rank]));
  const now = new Map(after.rows.slice(0, after.length).map((r) => [r.pairId, r.rank]));
  const ids = new Set([...was.keys(), ...now.keys()]);
  const moves = [...ids]
    .map((id) => ({ pairId: id, label: label(id), from: was.get(id) ?? null, to: now.get(id) ?? null }))
    .filter((m) => m.from !== m.to);
  const size = (m: (typeof moves)[number]) => Math.abs((m.from ?? 1000) - (m.to ?? 1000));
  moves.sort((x, y) => size(y) - size(x) || (x.to ?? Infinity) - (y.to ?? Infinity));
  return { moved: moves.length, moves: moves.slice(0, 6) };
}
