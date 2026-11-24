/**
 * Runs the engine for the comparison and conflict screens. Pure (no I/O), so it
 * can run in a Web Worker and in unit tests.
 */
import { shortProgramName } from '@pairwise/data';
import { buildEngineInput, type CoupleData } from '@pairwise/db';
import {
  BAND_LABEL,
  effectiveComparisons,
  describeConflict,
  describeLink,
  learningStatus,
  nextQuestions,
  NO_MATCH,
  runEngine,
  type Band,
  type Comparison,
  type Conflict,
  type Link,
  type Pair,
  type Tier,
} from '@pairwise/engine';

export interface ProgramSide {
  id: string;
  name: string;
  /** Abbreviation for tight spaces ("Hopkins Plastics"). */
  short: string;
  place: string;
  lat: number | null;
  lon: number | null;
  tier: Tier | null;
}

export interface PairView {
  id: string;
  /** [partner A's program, partner B's program]; null side = No Match. */
  sides: [ProgramSide | null, ProgramSide | null];
  distanceMi: number | null;
  band: Band;
  bandLabel: string;
}

export interface QuestionView {
  left: PairView;
  right: PairView;
  kind: 'calibration' | 'active' | 'partner';
  /** Set when the partner already answered this one (separate answering). */
  partnerAnswer?: 'left' | 'right' | 'tie';
}

export interface ConflictView {
  id: string;
  kind: Conflict['kind'];
  text: string;
  links?: Array<Link & { text: string }>;
  comparisonIds?: string[];
  /** Disagreements: the two answers, by who gave them. */
  answers?: Array<{ by: 'me' | 'partner'; winner: 'left' | 'right' | 'tie' }>;
  left?: PairView;
  right?: PairView;
}

export interface Analysis {
  hasBothLists: boolean;
  question: QuestionView | null;
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
  const tierOf = (k: 0 | 1, programId: string) => input.lists[k].find((e) => e.programId === programId)?.tier ?? null;

  const view = (pair: Pair): PairView => ({
    id: pair.id,
    sides: [0, 1].map((k) => {
      const ref = pair.programs[k as 0 | 1];
      if (ref === NO_MATCH) return null;
      const p = input.programs[ref];
      return { id: ref, name: p.name, short: shortProgramName(p.name, p.shortName), place: [p.city, p.state].filter(Boolean).join(', '), lat: p.lat, lon: p.lon, tier: tierOf(k as 0 | 1, ref) };
    }) as [ProgramSide | null, ProgramSide | null],
    distanceMi: pair.distanceMi,
    band: pair.band,
    bandLabel: BAND_LABEL[pair.band],
  });
  const viewById = (id: string) => {
    const p = byId.get(id);
    return p ? view(p) : undefined;
  };

  const status = learningStatus(list, posterior, input.comparisons);
  const ctx = { programs: input.programs, partnerNames: opts.names };
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
        question = { left: l, right: r, kind: 'partner', partnerAnswer: pending.winner };
      } else {
        question = toQuestion(nextQuestions(list, posterior, 1, { comparisons: input.comparisons })[0]);
      }
    } else {
      question = toQuestion(nextQuestions(list, posterior, 1, { comparisons: input.comparisons })[0]);
    }
  }

  function toQuestion(q: ReturnType<typeof nextQuestions>[number] | undefined): QuestionView | null {
    if (!q) return null;
    const l = viewById(q.left);
    const r = viewById(q.right);
    return l && r ? { left: l, right: r, kind: q.kind } : null;
  }

  return {
    hasBothLists,
    question,
    confidence: status.confidence,
    answered: effectiveComparisons(input.comparisons).counted.length,
    done: status.done,
    conflicts: conflicts.map((c) => conflictView(c)),
  };

  function conflictView(c: Conflict): ConflictView {
    const base = { id: c.id, kind: c.kind, text: describeConflict(ctx, c) };
    switch (c.kind) {
      case 'cycle':
        return { ...base, links: c.links.map((l) => ({ ...l, text: describeLink(ctx, l) })) };
      case 'tier_a_collision':
        return { ...base, left: viewById(c.partner1Example), right: viewById(c.partner2Example) };
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
