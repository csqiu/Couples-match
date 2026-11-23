import type { CoupleData } from '@pairwise/db';
import { analyze, type Analysis, type AnalyzeOptions } from './analysis';
import { checkMove, computeFinalList, type FinalList, type ListOptions, type MoveResult } from './final-list';

export type EngineRequest =
  | { kind: 'analyze'; data: CoupleData; opts: AnalyzeOptions }
  | { kind: 'list'; data: CoupleData; opts: ListOptions }
  | { kind: 'move'; data: CoupleData; moving: string; target: string; names: [string, string] };

export type EngineResponse<R extends EngineRequest> = R['kind'] extends 'analyze'
  ? Analysis
  : R['kind'] extends 'list'
    ? FinalList
    : MoveResult;

/** Same computation on the main thread, for browsers without module workers. */
export function runLocally(req: EngineRequest): unknown {
  switch (req.kind) {
    case 'analyze':
      return analyze(req.data, req.opts);
    case 'list':
      return computeFinalList(req.data, req.opts);
    case 'move':
      return checkMove(req.data, req.moving, req.target, req.names);
  }
}
