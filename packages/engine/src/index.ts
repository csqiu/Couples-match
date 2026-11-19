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

import { buildCandidates } from './candidates.js';
import { findConflicts, type Conflict } from './conflicts.js';
import { buildConstraintGraph, type Graph } from './graph.js';
import { rankPairs, type RankedList } from './rank.js';
import { defaultPosterior, scorePairs } from './scoring.js';
import type { EngineInput, Pair, Posterior } from './types.js';

export interface EngineResult {
  pairs: Pair[];
  graph: Graph;
  conflicts: Conflict[];
  list: RankedList;
}

/** Full rebuild: candidates → graph → scores → conflicts → ranked list. */
export function runEngine(input: EngineInput, posterior: Posterior = defaultPosterior()): EngineResult {
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const scores = scorePairs(pairs, posterior, input.settings);
  const conflicts = findConflicts(graph, posterior, input.comparisons);
  const list = rankPairs(graph, scores);
  return { pairs, graph, conflicts, list };
}
