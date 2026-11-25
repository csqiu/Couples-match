/**
 * Runs the engine for the comparison and conflict screens. Pure (no I/O), so it
 * can run in a Web Worker and in unit tests.
 */
import { buildEngineInput, type CoupleData, type StoredSettings } from '@pairwise/db';
import {
  effectiveComparisons,
  describeConflict,
  describeLink,
  learningStatus,
  nextQuestions,
  NO_MATCH,
  questionKey,
  runEngine,
  type Comparison,
  type Conflict,
  type EngineInput,
  type Link,
  type Pair,
} from '@pairwise/engine';

import { linkSource, pairViewer, shortNamed, type LinkSource, type PairView, type ProgramSide } from './pair-view';

export { pairViewer };
export type { PairView, ProgramSide };

/** One "this pair above that one" statement in a conflict, with both pairs and where it comes from. */
export interface LinkView extends Link {
  text: string;
  fromPair: PairView | null;
  toPair: PairView | null;
  /** Each pair's place in the engine's order (1-based), for "#4"-style labels. */
  fromRank: number | null;
  toRank: number | null;
  source: LinkSource;
}

export interface QuestionView {
  left: PairView;
  right: PairView;
  /** 'later': one the couple chose to come back to, asked once the others run out. */
  kind: 'calibration' | 'active' | 'partner' | 'later';
  /** Flagged to discuss together. */
  flagged: boolean;
  /** Set when the partner already answered this one (separate answering). */
  partnerAnswer?: 'left' | 'right' | 'tie';
}

export interface ConflictView {
  id: string;
  kind: Conflict['kind'];
  text: string;
  links?: LinkView[];
  comparisonIds?: string[];
  /** Disagreements: the two answers, by who gave them. */
  answers?: Array<{ by: 'me' | 'partner'; winner: 'left' | 'right' | 'tie' }>;
  left?: PairView;
  right?: PairView;
}

/** A question flagged to discuss, with the couple's answer so far (if any). */
export interface FlaggedView {
  key: string;
  left: PairView;
  right: PairView;
  /** Which side the latest counted answer chose, or null if not answered yet. */
  answer: 'left' | 'right' | 'tie' | null;
  deferred: boolean;
}

export interface Analysis {
  hasBothLists: boolean;
  question: QuestionView | null;
  flagged: FlaggedView[];
  /** Questions waiting to come back to. */
  deferred: number;
  confidence: number;
  answered: number;
  done: boolean;
  conflicts: ConflictView[];
}

export interface AnalyzeOptions {
  me: string;
  names: [string, string];
  answerMode: 'together' | 'separately';
}

export function analyze(data: CoupleData, opts: AnalyzeOptions): Analysis {
  const input = buildEngineInput(data);
  const hasBothLists = input.lists[0].some((e) => e.acceptable) && input.lists[1].some((e) => e.acceptable);
  const { pairs, conflicts, list, posterior } = runEngine(input);
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const view = pairViewer(input);
  const viewById = (id: string) => {
    const p = byId.get(id);
    return p ? view(p) : undefined;
  };

  const rankOf = (id: string) => {
    const i = list.position.get(id);
    return i === undefined ? null : i + 1;
  };
  const status = learningStatus(list, posterior, input.comparisons);
  const stored = (data.couple.settings ?? {}) as StoredSettings;
  const counted = effectiveComparisons(input.comparisons).counted;
  const answeredKeys = new Set(counted.map((c) => questionKey(c.left, c.right)));
  const deferred = (stored.deferredQuestions ?? []).filter((k) => !answeredKeys.has(k));
  const flaggedKeys = new Set(stored.flaggedQuestions ?? []);
  const splitKey = (k: string) => k.split('#') as [string, string];
  const ctx = { programs: shortNamed(input.programs, input.lists), partnerNames: opts.names };
  const key = (a: string, b: string) => (a < b ? `${a}#${b}` : `${b}#${a}`);

  let question: QuestionView | null = null;
  if (hasBothLists) {
    if (opts.answerMode === 'separately') {
      // Ask what my partner answered and I haven't (so both of us answer the same questions),
      // then new questions that neither of us has asked or settled.
      const mine = new Set(input.comparisons.filter((c) => c.answeredBy === opts.me).map((c) => key(c.left, c.right)));
      const agreed = new Set(input.comparisons.filter((c) => c.bothAgreed).map((c) => key(c.left, c.right)));
      const pending = input.comparisons.find(
        (c) => c.answeredBy && c.answeredBy !== opts.me && !mine.has(key(c.left, c.right)) && !agreed.has(key(c.left, c.right)),
      );
      const l = pending && viewById(pending.left);
      const r = pending && viewById(pending.right);
      if (pending && l && r) {
        question = { left: l, right: r, kind: 'partner', partnerAnswer: pending.winner, flagged: flaggedKeys.has(questionKey(l.id, r.id)) };
      } else {
        question = toQuestion(nextQuestions(list, posterior, 1, { comparisons: input.comparisons, skip: deferred })[0]);
      }
    } else {
      question = toQuestion(nextQuestions(list, posterior, 1, { comparisons: input.comparisons, skip: deferred })[0]);
    }
    // Nothing else to ask: bring back the ones saved for later, oldest first.
    for (const k of deferred) {
      if (question) break;
      const [a, b] = splitKey(k);
      const l = viewById(a);
      const r = viewById(b);
      if (l && r) question = { left: l, right: r, kind: 'later', flagged: flaggedKeys.has(k) };
    }
  }

  const flagged: FlaggedView[] = [];
  for (const k of flaggedKeys) {
    const [a, b] = splitKey(k);
    const l = viewById(a);
    const r = viewById(b);
    if (!l || !r) continue;
    const c = counted.find((x) => questionKey(x.left, x.right) === k);
    const won = c ? (c.winner === 'tie' ? 'tie' : c.winner === 'left' ? c.left : c.right) : null;
    flagged.push({ key: k, left: l, right: r, answer: won === null ? null : won === 'tie' ? 'tie' : won === a ? 'left' : 'right', deferred: deferred.includes(k) });
  }

  function toQuestion(q: ReturnType<typeof nextQuestions>[number] | undefined): QuestionView | null {
    if (!q) return null;
    const l = viewById(q.left);
    const r = viewById(q.right);
    return l && r ? { left: l, right: r, kind: q.kind, flagged: flaggedKeys.has(questionKey(l.id, r.id)) } : null;
  }

  return {
    hasBothLists,
    question,
    flagged,
    deferred: deferred.length,
    confidence: status.confidence,
    answered: effectiveComparisons(input.comparisons).counted.length,
    done: status.done,
    conflicts: conflicts.map((c) => conflictView(c)),
  };

  function conflictView(c: Conflict): ConflictView {
    const base = { id: c.id, kind: c.kind, text: describeConflict(ctx, c) };
    switch (c.kind) {
      case 'cycle':
        return {
          ...base,
          links: c.links.map((l) => ({
            ...l,
            text: describeLink(ctx, l),
            fromPair: viewById(l.from) ?? null,
            toPair: viewById(l.to) ?? null,
            fromRank: rankOf(l.from),
            toRank: rankOf(l.to),
            source: linkSource(l, opts.names),
          })),
        };
      case 'surprising_answer':
        return { ...base, comparisonIds: [c.comparison.id], left: viewById(c.comparison.left), right: viewById(c.comparison.right), answers: [{ by: c.comparison.answeredBy === opts.me ? 'me' : 'partner', winner: c.comparison.winner }] };
      case 'disagreement': {
        const first = c.comparisons[0];
        // Express both answers relative to the first comparison's left/right.
        const answers = c.comparisons.map((x: Comparison) => ({
          by: (x.answeredBy === opts.me ? 'me' : 'partner') as 'me' | 'partner',
          winner: x.winner === 'tie' ? ('tie' as const) : (x.winner === 'left' ? x.left : x.right) === first.left ? ('left' as const) : ('right' as const),
        }));
        return { ...base, comparisonIds: c.comparisons.map((x: Comparison) => x.id), left: viewById(first.left), right: viewById(first.right), answers };
      }
    }
  }
}
