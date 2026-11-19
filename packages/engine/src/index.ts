export * from './types.js';
export * from './rules.js';
export * from './defaults.js';
export * from './geo.js';
export * from './candidates.js';
export * from './scoring.js';
export * from './graph.js';
export * from './conflicts.js';
export * from './rank.js';
export * from './fees.js';
export * from './text.js';
export * from './rng.js';
export * from './features.js';
export * from './posterior.js';
export * from './learning.js';
export * from './questions.js';

import { buildCandidates } from './candidates.js';
import { findConflicts, type Conflict } from './conflicts.js';
import { buildConstraintGraph, type Graph } from './graph.js';
import { rankPairs, type RankedList } from './rank.js';
import { fitModel, priorPosterior } from './learning.js';
import { scorePairs } from './scoring.js';
import type { EngineInput, Pair, Posterior } from './types.js';

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
  posterior ??= fitModel(priorPosterior(input.seed), input.comparisons, { pairs, settings: input.settings, seed: input.seed });
  const scores = scorePairs(pairs, posterior, input.settings);
  const conflicts = findConflicts(graph, posterior, input.comparisons);
  const list = rankPairs(graph, scores);
  return { posterior, pairs, graph, conflicts, list };
}
