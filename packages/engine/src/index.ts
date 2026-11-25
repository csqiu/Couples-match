export * from './types';
export * from './rules';
export * from './defaults';
export * from './geo';
export * from './candidates';
export * from './scoring';
export * from './graph';
export * from './conflicts';
export * from './rank';
export * from './fees';
export * from './text';
export * from './rng';
export * from './features';
export * from './posterior';
export * from './learning';
export * from './questions';
export * from './equivalence';
export * from './answers';

import { buildCandidates } from './candidates';
import { findConflicts, type Conflict } from './conflicts';
import { buildConstraintGraph, type Graph } from './graph';
import { rankPairs, type RankedList } from './rank';
import { fitModel, priorPosterior } from './learning';
import { scorePairs } from './scoring';
import type { EngineInput, Pair, Posterior } from './types';

export interface EngineResult {
  posterior: Posterior;
  pairs: Pair[];
  graph: Graph;
  conflicts: Conflict[];
  list: RankedList;
}

/**
 * Full rebuild: candidates → graph → posterior → scores → conflicts → ranked list.
 * Without an explicit posterior, the model is fitted to the couple's answers
 * from the prior, using `input.seed` — so a saved version reproduces exactly.
 */
export function runEngine(input: EngineInput, posterior?: Posterior): EngineResult {
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  // Per-program values (buildLayout) are available but off: in the benchmark they did not
  // beat the shared model within 40 answers (DECISIONS.md #119).
  posterior ??= fitModel(priorPosterior(input.seed), input.comparisons, { pairs, settings: input.settings, seed: input.seed });
  const scores = scorePairs(pairs, posterior, input.settings);
  const conflicts = findConflicts(graph, posterior, input.comparisons);
  const list = rankPairs(graph, scores);
  return { posterior, pairs, graph, conflicts, list };
}
