import type { CoupleData } from '@pairwise/db';
import { analyze, type Analysis, type AnalyzeOptions } from './analysis';
import { explore, type ExploreOptions, type ExploreResult } from './explore';
import { checkMove, computeFinalList, type FinalList, type ListOptions, type MoveResult } from './final-list';

export type EngineRequest =
  | { kind: 'analyze'; data: CoupleData; opts: AnalyzeOptions }
  | { kind: 'list'; data: CoupleData; opts: ListOptions }
  | { kind: 'move'; data: CoupleData; moving: string; target: string; names: [string, string]; moved?: 'higher' | 'lower' }
  | { kind: 'explore'; data: CoupleData; opts: ExploreOptions };

export type EngineResponse<R extends EngineRequest> = R['kind'] extends 'analyze'
  ? Analysis
  : R['kind'] extends 'list'
    ? FinalList
    : R['kind'] extends 'explore'
      ? ExploreResult
      : MoveResult;

/** Same computation on the main thread, for browsers without module workers. */
export function runLocally(req: EngineRequest): unknown {
  switch (req.kind) {
    case 'analyze':
      return analyze(req.data, req.opts);
    case 'list':
      return computeFinalList(req.data, req.opts);
    case 'move':
      return checkMove(req.data, req.moving, req.target, req.names, req.moved);
    case 'explore':
      return explore(req.data, req.opts);
  }
}
