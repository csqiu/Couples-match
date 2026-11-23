/**
 * The final list (step 6): ordered pairs with "why is this here?", fees, the
 * trade-offs report and the pre-certification checklist. Pure, so it runs in the
 * Web Worker and in unit tests.
 */
import { buildEngineInput, type CoupleData } from '@pairwise/db';
import {
  BAND_LABEL,
  describeExplanation,
  describeLink,
  explainOrder,
  extraRankFeeUsd,
  inversionReport,
  lengthFeeUsd,
  NO_MATCH,
  NRMP_RULES,
  proposeMove,
  runEngine,
  type Band,
  type EngineInput,
  type EngineResult,
  type Link,
  type MatchType,
  type Pin,
} from '@pairwise/engine';

export interface ListSide {
  id: string;
  name: string;
  place: string;
  /** The NRMP code to type into R3 ('' when the partner hasn't entered it yet). */
  code: string;
}

export interface ListRow {
  rank: number;
  pairId: string;
  sides: [ListSide, ListSide];
  distanceMi: number | null;
  band: Band;
  bandLabel: string;
  /** Plain-language reason this row is below the one above it. */
  why: string;
}

export interface ChecklistItem {
  ok: boolean;
  label: string;
  detail?: string;
}

export interface FinalList {
  /** Every candidate pair in order (up to 300). The list the couple submits is the first `length`. */
  rows: ListRow[];
  /** The couple's chosen length (clamped to the rows available). */
  length: number;
  trades: string[];
  hasCycles: boolean;
}

export interface PartnerFee {
  uniqueCodes: number;
  extraRankFeeUsd: number;
  lengthFeeUsd: number;
  couplesFeeUsd: number;
  totalUsd: number;
}

export interface Fees {
  ranks: number;
  partners: [PartnerFee, PartnerFee];
  totalUsd: number;
  /** Trimming this many pairs or fewer drops a length-fee tier. */
  tierWarning: { pairsToCut: number; saveUsdPerPartner: number } | null;
}

/** NRMP fee estimate for the first n rows (rules.ts holds the numbers). */
export function feesFor(rows: ListRow[], n: number): Fees {
  const top = rows.slice(0, n);
  const partner = (k: 0 | 1): PartnerFee => {
    const uniqueCodes = new Set(top.map((r) => r.sides[k].id)).size; // No Match counts as a code.
    const extra = extraRankFeeUsd(uniqueCodes);
    const length = lengthFeeUsd(top.length);
    const couples = NRMP_RULES.couplesFeePerPartnerUsd;
    return { uniqueCodes, extraRankFeeUsd: extra, lengthFeeUsd: length, couplesFeeUsd: couples, totalUsd: extra + length + couples };
  };
  const partners: [PartnerFee, PartnerFee] = [partner(0), partner(1)];
  let tierWarning: Fees['tierWarning'] = null;
  const tier = NRMP_RULES.lengthFeeTiers.find((t) => top.length >= t.minRanks && top.length <= t.maxRanks);
  if (tier && top.length - (tier.minRanks - 1) <= 5) {
    tierWarning = { pairsToCut: top.length - (tier.minRanks - 1), saveUsdPerPartner: lengthFeeUsd(top.length) - lengthFeeUsd(tier.minRanks - 1) };
  }
  return { ranks: top.length, partners, totalUsd: partners[0].totalUsd + partners[1].totalUsd, tierWarning };
}

/** The pre-certification checklist for the first n rows. */
export function checklistFor(rows: ListRow[], n: number, names: [string, string], hasCycles: boolean): ChecklistItem[] {
  const top = rows.slice(0, n);
  const missing = (k: 0 | 1) => [...new Set(top.map((r) => r.sides[k]).filter((s) => s.id !== NO_MATCH && !s.code).map((s) => s.name))];
  const firstNoMatch = top.findIndex((r) => r.band === 'no_match');
  const noMatchAtBottom = firstNoMatch === -1 || top.slice(firstNoMatch).every((r) => r.band === 'no_match');
  return [
    { ok: top.length > 0, label: `Both lists have ${top.length} ranks`, detail: 'Each row is one rank on each partner’s R3 list.' },
    ...([0, 1] as const).map((k) => {
      const m = missing(k);
      return {
        ok: m.length === 0,
        label: `${names[k]}: NRMP codes entered for every program`,
        detail: m.length ? `Missing (add them on the Rank step): ${m.join('; ')}` : undefined,
      };
    }),
    {
      ok: noMatchAtBottom,
      label: 'No Match pairs are at the bottom',
      detail: noMatchAtBottom ? undefined : 'NRMP recommends ranking every pair where you both match first.',
    },
    { ok: !hasCycles, label: 'No unresolved conflicts', detail: hasCycles ? 'Resolve them on the Conflicts step.' : undefined },
  ];
}

export interface ListOptions {
  names: [string, string];
  matchType: MatchType;
}

// One engine run per distinct input, shared by the list, explanations and drag checks.
let cache: { key: string; input: EngineInput; result: EngineResult } | null = null;
function run(data: CoupleData) {
  const key = JSON.stringify(data);
  if (cache?.key !== key) {
    const input = buildEngineInput(data);
    cache = { key, input, result: runEngine(input) };
  }
  return cache;
}

export function computeFinalList(data: CoupleData, opts: ListOptions): FinalList {
  const { input, result } = run(data);
  const { list } = result;
  const ctx = { programs: input.programs, partnerNames: opts.names };
  const noMatchCode = NRMP_RULES.noMatchCode[opts.matchType];
  const codeOf = (k: 0 | 1, id: string) => input.lists[k].find((e) => e.programId === id)?.nrmpCode ?? '';

  const side = (k: 0 | 1, id: string): ListSide => {
    if (id === NO_MATCH) return { id, name: 'No Match', place: '', code: noMatchCode };
    const p = input.programs[id];
    return { id, name: p.name, place: [p.city, p.state].filter(Boolean).join(', '), code: codeOf(k, id) ?? '' };
  };

  const byId = new Map(result.pairs.map((p) => [p.id, p]));
  const ordered = list.order.slice(0, NRMP_RULES.maxRanksPerPartner).map((id) => byId.get(id)!);
  const rows: ListRow[] = ordered.map((pair, i) => ({
    rank: i + 1,
    pairId: pair.id,
    sides: [side(0, pair.programs[0]), side(1, pair.programs[1])],
    distanceMi: pair.distanceMi,
    band: pair.band,
    bandLabel: BAND_LABEL[pair.band],
    why: i === 0 ? 'This is the top of your list.' : describeExplanation(ctx, explainOrder(list, ordered[i - 1].id, pair.id)),
  }));

  const trades = inversionReport(list, 5).map((t) => {
    const who = opts.names[t.partner];
    const got = input.programs[list.rows[t.rank - 1].pair.programs[t.partner]]?.name ?? 'a program';
    const better = input.programs[t.betterProgram]?.name ?? t.betterProgram;
    const why = t.because.length
      ? t.because.map((b) => (b === 'closer' ? 'you’d be closer together' : `${opts.names[1 - t.partner]} gets a program they prefer`)).join(' and ')
      : 'of a rule you set';
    return `#${t.rank}: ${who} gets ${got} ahead of ${better} (first at #${t.betterProgramFirstRank}), because ${why}.`;
  });

  return { rows, length: Math.min(list.length, rows.length), trades, hasCycles: list.hasCycles };
}

export type MoveResult =
  | { ok: true; pin: Pin }
  | { ok: false; blocking: Array<Link & { text: string }> };

/** The couple dragged `moving` directly above `target`: a pin to save, or why it isn't allowed. */
export function checkMove(data: CoupleData, moving: string, target: string, names: [string, string]): MoveResult {
  const { input, result } = run(data);
  const res = proposeMove(result.list, moving, target);
  if (res.ok) return res;
  const ctx = { programs: input.programs, partnerNames: names };
  return { ok: false, blocking: res.blocking.map((l) => ({ ...l, text: describeLink(ctx, l) })) };
}
