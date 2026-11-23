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
  feeEstimate,
  inversionReport,
  NO_MATCH,
  NRMP_RULES,
  proposeMove,
  runEngine,
  type Band,
  type EngineInput,
  type EngineResult,
  type FeeEstimate,
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
  rows: ListRow[];
  /** How many candidate pairs exist (the length slider's upper bound, capped at 300). */
  totalPairs: number;
  length: number;
  fees: FeeEstimate;
  trades: string[];
  checklist: ChecklistItem[];
  hasCycles: boolean;
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
  const { list, pairs } = result;
  const ctx = { programs: input.programs, partnerNames: opts.names };
  const noMatchCode = NRMP_RULES.noMatchCode[opts.matchType];
  const codeOf = (k: 0 | 1, id: string) => input.lists[k].find((e) => e.programId === id)?.nrmpCode ?? '';

  const side = (k: 0 | 1, id: string): ListSide => {
    if (id === NO_MATCH) return { id, name: 'No Match', place: '', code: noMatchCode };
    const p = input.programs[id];
    return { id, name: p.name, place: [p.city, p.state].filter(Boolean).join(', '), code: codeOf(k, id) ?? '' };
  };

  const rows: ListRow[] = list.rows.map((r, i) => ({
    rank: r.rank,
    pairId: r.pair.id,
    sides: [side(0, r.pair.programs[0]), side(1, r.pair.programs[1])],
    distanceMi: r.pair.distanceMi,
    band: r.pair.band,
    bandLabel: BAND_LABEL[r.pair.band],
    why: i === 0 ? 'This is the top of your list.' : describeExplanation(ctx, explainOrder(list, list.rows[i - 1].pair.id, r.pair.id)),
  }));

  const fees = feeEstimate(list.rows.map((r) => r.pair));

  const trades = inversionReport(list, 5).map((t) => {
    const who = opts.names[t.partner];
    const got = input.programs[list.rows[t.rank - 1].pair.programs[t.partner]]?.name ?? 'a program';
    const better = input.programs[t.betterProgram]?.name ?? t.betterProgram;
    const why = t.because.length
      ? t.because.map((b) => (b === 'closer' ? 'you’d be closer together' : `${opts.names[1 - t.partner]} gets a program they prefer`)).join(' and ')
      : 'of a rule you set';
    return `#${t.rank}: ${who} gets ${got} ahead of ${better} (first at #${t.betterProgramFirstRank}), because ${why}.`;
  });

  // Pre-certification checklist.
  const missing = (k: 0 | 1) => [...new Set(rows.map((r) => r.sides[k]).filter((s) => s.id !== NO_MATCH && !s.code).map((s) => s.name))];
  const firstNoMatch = rows.findIndex((r) => r.band === 'no_match');
  const noMatchAtBottom = firstNoMatch === -1 || rows.slice(firstNoMatch).every((r) => r.band === 'no_match');
  const checklist: ChecklistItem[] = [
    { ok: true, label: `Both lists have ${rows.length} ranks`, detail: 'Each row is one rank on each partner’s list.' },
    ...([0, 1] as const).map((k) => {
      const m = missing(k);
      return {
        ok: m.length === 0,
        label: `${opts.names[k]}: NRMP codes entered for every program`,
        detail: m.length ? `Missing: ${m.join('; ')}` : undefined,
      };
    }),
    {
      ok: noMatchAtBottom,
      label: 'No Match pairs are at the bottom',
      detail: noMatchAtBottom ? undefined : 'NRMP recommends ranking every pair where you both match first.',
    },
    { ok: !list.hasCycles, label: 'No unresolved conflicts', detail: list.hasCycles ? 'Resolve them on the Conflicts step.' : undefined },
  ];

  return {
    rows,
    totalPairs: Math.min(NRMP_RULES.maxRanksPerPartner, pairs.length),
    length: list.length,
    fees,
    trades,
    checklist,
    hasCycles: list.hasCycles,
  };
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
