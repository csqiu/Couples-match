import { bandFor, programDistanceMi } from './geo';
import {
  NO_MATCH,
  type EngineInput,
  type Pair,
  type PairId,
  type ProgramRef,
  type RankEntry,
  type Tier,
} from './types';

const TIER_ORDER: Record<Tier, number> = { A: 0, B: 1, C: 2 };

export function pairId(a: ProgramRef, b: ProgramRef): PairId {
  return `${a}|${b}`;
}

export function splitPairId(id: PairId): [ProgramRef, ProgramRef] {
  const i = id.indexOf('|');
  return [id.slice(0, i), id.slice(i + 1)];
}

export interface NormalizedEntry extends RankEntry {
  /** 1-based rank among acceptable programs, after ordering by (tier, rank). */
  effectiveRank: number;
  posInTier: number;
  tierSize: number;
}

/**
 * Orders a partner's list by tier, then by the partner's rank within the tier,
 * and drops unacceptable programs. If a partner's ranks and tiers disagree
 * (a Tier B program ranked above a Tier A one), the tier wins.
 */
export function normalizeList(list: RankEntry[]): NormalizedEntry[] {
  const seen = new Set<string>();
  const acceptable = list
    .filter((e) => e.acceptable && e.programId !== NO_MATCH)
    .filter((e) => (seen.has(e.programId) ? false : (seen.add(e.programId), true)))
    .slice()
    .sort((x, y) => TIER_ORDER[x.tier] - TIER_ORDER[y.tier] || x.rank - y.rank || x.programId.localeCompare(y.programId));

  const tierCounts: Record<Tier, number> = { A: 0, B: 0, C: 0 };
  for (const e of acceptable) tierCounts[e.tier]++;
  const seenInTier: Record<Tier, number> = { A: 0, B: 0, C: 0 };

  return acceptable.map((e, i) => ({
    ...e,
    effectiveRank: i + 1,
    posInTier: ++seenInTier[e.tier],
    tierSize: tierCounts[e.tier],
  }));
}

/**
 * Every (i, j) with i from partner 1's acceptable list plus NO_MATCH and j from
 * partner 2's acceptable list plus NO_MATCH, minus (NO_MATCH, NO_MATCH) and
 * excluded pairs. Order is deterministic: partner 1's order, then partner 2's.
 */
export function buildCandidates(input: EngineInput): Pair[] {
  const lists = [normalizeList(input.lists[0]), normalizeList(input.lists[1])] as const;
  const excluded = new Set(input.exclusions.map((x) => pairId(x.programA, x.programB)));
  const bands = input.settings.distanceBands;

  const side = (k: 0 | 1) => [
    ...lists[k].map((e) => ({ ref: e.programId as ProgramRef, entry: e as NormalizedEntry | null })),
    { ref: NO_MATCH as ProgramRef, entry: null },
  ];

  const pairs: Pair[] = [];
  for (const left of side(0)) {
    for (const right of side(1)) {
      if (left.ref === NO_MATCH && right.ref === NO_MATCH) continue;
      const id = pairId(left.ref, right.ref);
      if (excluded.has(id)) continue;

      let distanceMi: number | null = null;
      let band: Pair['band'] = 'no_match';
      if (left.entry && right.entry) {
        const pa = input.programs[left.ref];
        const pb = input.programs[right.ref];
        if (!pa || !pb) throw new Error(`Unknown program in rank list: ${!pa ? left.ref : right.ref}`);
        distanceMi = programDistanceMi(pa, pb);
        const sameCbsa = !!pa.cbsaCode && pa.cbsaCode === pb.cbsaCode;
        band = bandFor(distanceMi, sameCbsa, bands);
      }

      pairs.push({
        id,
        programs: [left.ref, right.ref],
        rank: [left.entry?.effectiveRank ?? lists[0].length + 1, right.entry?.effectiveRank ?? lists[1].length + 1],
        tier: [left.entry?.tier ?? null, right.entry?.tier ?? null],
        posInTier: [left.entry?.posInTier ?? 1, right.entry?.posInTier ?? 1],
        tierSize: [left.entry?.tierSize ?? 1, right.entry?.tierSize ?? 1],
        distanceMi,
        band,
        index: pairs.length,
      });
    }
  }
  return pairs;
}

export function isNoMatchPair(p: Pair): boolean {
  return p.programs[0] === NO_MATCH || p.programs[1] === NO_MATCH;
}
