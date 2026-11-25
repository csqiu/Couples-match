/**
 * The final list (step 6): ordered pairs with "why is this here?", fees, the
 * trade-offs report and the pre-certification checklist. Pure, so it runs in the
 * Web Worker and in unit tests.
 */
import { shortProgramName } from '@pairwise/data';
import { buildEngineInput, type CoupleData, type StoredSettings } from '@pairwise/db';
import {
  BAND_LABEL,
  describeExplanation,
  describeLink,
  explainOrder,
  extraRankFeeUsd,
  hardClosure,
  mustRankAbove,
  normalizeList,
  pairLabel,
  tidyOrder,
  tidyRowOf,
  witnessAbove,
  inversionReport,
  lengthFeeUsd,
  NO_MATCH,
  NRMP_RULES,
  proposeMove,
  runEngine,
  unreachableRows,
  type Band,
  type EngineInput,
  type EngineResult,
  type Link,
  type MatchType,
  type Pair,
  type Pin,
  type TidyKey,
} from '@pairwise/engine';

/** NRMP's limit on a rank list (per partner; a couple's list has one row per rank). */
export const RANK_LIMIT = NRMP_RULES.maxRanksPerPartner;

export interface ListSide {
  id: string;
  name: string;
  /** Abbreviation for tight spaces ("Hopkins Plastics"). */
  short: string;
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
  /** A No Match row held at the end of the list (moves only once unlocked). */
  locked: boolean;
  /** Added by hand from "Not on your list" (can be taken off again). */
  added: boolean;
}

/** A pair that could be on the list but isn't (the side panel). */
export interface AvailablePair {
  pairId: string;
  sides: [ListSide, ListSide];
  distanceMi: number | null;
  band: Band;
  bandLabel: string;
}

export interface ChecklistItem {
  ok: boolean;
  label: string;
  detail?: string;
}

/** One of a partner's programs, in their own order (for the outcome simulator). */
export interface ProgramOption {
  id: string;
  name: string;
  short: string;
  place: string;
  /** 1-based rank among the partner's acceptable programs. */
  rank: number;
}

export type ListOrder = TidyKey | 'engine';
export const DEFAULT_LIST_ORDER: ListOrder = 'partner1';

export interface FinalList {
  /**
   * The couple's list in order: the best pairs where both match (as many as the length
   * setting leaves room for), any they added by hand, then the No Match rows. Can be
   * longer than RANK_LIMIT when pairs were added by hand; only the first RANK_LIMIT count.
   */
  rows: ListRow[];
  /** Rows that count: min(rows, RANK_LIMIT). */
  length: number;
  /** The length setting (both-match pairs + No Match rows), before hand-added pairs. */
  target: number;
  /** Smallest length setting: just the No Match rows. */
  minTarget: number;
  /** Largest useful length setting (every candidate pair, capped at RANK_LIMIT). */
  maxTarget: number;
  /** Pairs where both match that aren't on the list, best first. */
  available: AvailablePair[];
  noMatchLocked: boolean;
  trades: string[];
  hasCycles: boolean;
  /** How the rows are shown (see StoredSettings.listOrder). */
  order: ListOrder;
  /** Rows shown in a different place than the engine's own order, without changing any outcome. */
  tidied: number;
  /** Each partner's programs in their own order. */
  programs: [ProgramOption[], ProgramOption[]];
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
    unreachableItem(top),
    { ok: !hasCycles, label: 'No unresolved conflicts', detail: hasCycles ? 'Resolve them on the Conflicts step.' : undefined },
    ...(rows.length > RANK_LIMIT
      ? [{ ok: false, label: `The list is within NRMP’s ${RANK_LIMIT}-rank limit`, detail: `${rows.length - RANK_LIMIT} rows are past #${RANK_LIMIT} and won’t be submitted. Take some off or shorten the list.` }]
      : []),
  ];
}

/**
 * Rows that can never be the match: below (A, No Match), (No Match, B) or a copy of
 * themselves, which always work first. Only possible once No Match rows are unlocked.
 */
function unreachableItem(top: ListRow[]): ChecklistItem {
  const dead = unreachableRows(top.map((r) => [r.sides[0].id, r.sides[1].id] as const));
  const label = 'Every row can be your match';
  if (!dead.length) return { ok: true, label };
  const name = (r: ListRow) => `#${r.rank} (${r.sides[0].short} + ${r.sides[1].short})`;
  const shown = dead.slice(0, 3).map((d) => `${name(top[d.index])} can’t be reached, because ${name(top[d.blockedByIndex])} always works first`);
  const more = dead.length > shown.length ? ` And ${dead.length - shown.length} more.` : '';
  return {
    ok: false,
    label,
    detail: `${shown.join('; ')}.${more} Take these rows off or move them higher: they change nothing where they are but count toward the ${RANK_LIMIT}-rank limit and fees.`,
  };
}

export interface ListOptions {
  names: [string, string];
  matchType: MatchType;
}

// One engine run per distinct input, shared by the list, explanations and drag checks.
// The length setting and the app-only list settings don't change the engine's order,
// so they're left out of the key (moving the length slider doesn't re-run the engine).
let cache: { key: string; input: EngineInput; result: EngineResult } | null = null;
function run(data: CoupleData) {
  const { listLength: _l, includedPairs: _i, noMatchUnlocked: _u, listOrder: _o, deferredQuestions: _d, flaggedQuestions: _f, ...settings } =
    (data.couple.settings ?? {}) as StoredSettings;
  const engineData = { ...data, couple: { ...data.couple, settings: { ...settings, listLength: RANK_LIMIT } as never } };
  const key = JSON.stringify(engineData);
  if (cache?.key !== key) {
    const input = buildEngineInput(engineData);
    cache = { key, input, result: runEngine(input) };
  }
  return cache;
}

/** The engine run behind the final list (cached: free right after computeFinalList on the same data). */
export function engineFor(data: CoupleData): { input: EngineInput; result: EngineResult } {
  const { input, result } = run(data);
  return { input, result };
}

/** No Match rows in the fixed order: 1–NM, 2–NM, …, then NM–1, NM–2, … */
function noMatchPattern(pairs: Pair[]): Pair[] {
  const first = pairs.filter((p) => p.programs[1] === NO_MATCH).sort((a, b) => a.rank[0] - b.rank[0]);
  const second = pairs.filter((p) => p.programs[0] === NO_MATCH).sort((a, b) => a.rank[1] - b.rank[1]);
  return [...first, ...second];
}

export function computeFinalList(data: CoupleData, opts: ListOptions): FinalList {
  const { input, result } = run(data);
  const { list } = result;
  const stored = (data.couple.settings ?? {}) as StoredSettings;
  const ctx = { programs: input.programs, partnerNames: opts.names };
  const noMatchCode = NRMP_RULES.noMatchCode[opts.matchType];
  const codeOf = (k: 0 | 1, id: string) => input.lists[k].find((e) => e.programId === id)?.nrmpCode ?? '';
  const shortOf = (k: 0 | 1, id: string) => input.lists[k].find((e) => e.programId === id)?.shortName;

  const side = (k: 0 | 1, id: string): ListSide => {
    if (id === NO_MATCH) return { id, name: 'No Match', short: 'No Match', place: '', code: noMatchCode };
    const p = input.programs[id];
    return { id, name: p.name, short: shortProgramName(p.name, shortOf(k, id) ?? p.shortName), place: [p.city, p.state].filter(Boolean).join(', '), code: codeOf(k, id) ?? '' };
  };

  const byId = new Map(result.pairs.map((p) => [p.id, p]));
  const all = list.order.map((id) => byId.get(id)!);
  const matched = all.filter((p) => p.band !== 'no_match');
  const noMatch = all.filter((p) => p.band === 'no_match');
  const noMatchLocked = !stored.noMatchUnlocked;

  // Length setting = both-match pairs + the No Match rows, as in R3.
  const maxTarget = Math.min(RANK_LIMIT, all.length);
  const minTarget = Math.min(maxTarget, Math.max(1, noMatch.length));
  const target = Math.max(minTarget, Math.min(maxTarget, Math.round(stored.listLength ?? RANK_LIMIT)));
  const room = Math.max(0, target - noMatch.length);
  const top = new Set(matched.slice(0, room).map((p) => p.id));
  const added = new Set((stored.includedPairs ?? []).filter((id) => byId.has(id) && !top.has(id) && byId.get(id)!.band !== 'no_match'));
  const onList = (p: Pair) => top.has(p.id) || added.has(p.id);

  const engineOrder = noMatchLocked
    ? [...matched.filter(onList), ...noMatchPattern(noMatch)]
    : all.filter((p) => p.band === 'no_match' || onList(p));

  // The readable order: neighbours whose order can never change the outcome are sorted by
  // the reading key; anything a rule, an answer or a drag orders stays as it is.
  const order: ListOrder = stored.listOrder ?? DEFAULT_LIST_ORDER;
  const isLocked = (p: Pair) => noMatchLocked && p.band === 'no_match';
  const closure = hardClosure(list.graph);
  const idx = list.graph.index;
  const tidy = order === 'engine'
    ? null
    : tidyOrder(engineOrder.map((p) => tidyRowOf(p, isLocked(p))), order, (h, l) => mustRankAbove(closure, idx.get(h)!, idx.get(l)!));
  const ordered = tidy ? tidy.map((r) => byId.get(r.id)!) : engineOrder;
  const tidyPos = new Map(ordered.map((p, i) => [p.id, i]));
  const enginePos = new Map(engineOrder.map((p, i) => [p.id, i]));
  const keyWords = order === 'partner1' ? `${opts.names[0]}’s order` : order === 'partner2' ? `${opts.names[1]}’s order` : 'order of both your ranks';

  const rows: ListRow[] = ordered.map((pair, i) => {
    const locked = isLocked(pair);
    const prev = ordered[i - 1];
    let why: string;
    if (i === 0) why = 'This is the top of your list.';
    else if (locked) why = 'No Match rows stay at the end of the list, in this order. Unlock them to move them.';
    else if (tidy && enginePos.get(prev.id)! > enginePos.get(pair.id)!) {
      const w = witnessAbove(tidy, tidyPos, i - 1);
      why = `These two rows can go in either order without changing where you match${
        w ? `: #${tidyPos.get(w)! + 1} (${pairLabel(ctx, w)}) is above both, so whenever both are within reach, so is it` : ''
      }. They are shown in ${keyWords} to make the list easier to read.`;
    } else why = describeExplanation(ctx, explainOrder(list, prev.id, pair.id));
    return {
      rank: i + 1,
      pairId: pair.id,
      sides: [side(0, pair.programs[0]), side(1, pair.programs[1])],
      distanceMi: pair.distanceMi,
      band: pair.band,
      bandLabel: BAND_LABEL[pair.band],
      why,
      locked,
      added: added.has(pair.id),
    };
  });
  const tidied = ordered.filter((p, i) => engineOrder[i].id !== p.id).length;

  const programs = ([0, 1] as const).map((k) =>
    normalizeList(input.lists[k]).map((e) => {
      const s = side(k, e.programId);
      return { id: s.id, name: s.name, short: s.short, place: s.place, rank: e.effectiveRank };
    }),
  ) as [ProgramOption[], ProgramOption[]];

  const available: AvailablePair[] = matched
    .filter((p) => !onList(p))
    .map((p) => ({
      pairId: p.id,
      sides: [side(0, p.programs[0]), side(1, p.programs[1])],
      distanceMi: p.distanceMi,
      band: p.band,
      bandLabel: BAND_LABEL[p.band],
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

  return {
    rows,
    length: Math.min(rows.length, RANK_LIMIT),
    target,
    minTarget,
    maxTarget,
    available,
    noMatchLocked,
    trades,
    hasCycles: list.hasCycles,
    order,
    tidied,
    programs,
  };
}

export type MoveResult =
  | { ok: true; pin: Pin }
  | { ok: false; blocking: Array<Link & { text: string }> };

/**
 * `higher` should sit directly above `lower`: a pin to save, or why it isn't allowed.
 * `moved` is the one the couple dragged ('higher' = dragged up, 'lower' = dragged down).
 */
export function checkMove(data: CoupleData, higher: string, lower: string, names: [string, string], moved: 'higher' | 'lower' = 'higher'): MoveResult {
  const { input, result } = run(data);
  const res = proposeMove(result.list, higher, lower, moved);
  if (res.ok) return res;
  const ctx = { programs: input.programs, partnerNames: names };
  return { ok: false, blocking: res.blocking.map((l) => ({ ...l, text: describeLink(ctx, l) })) };
}
