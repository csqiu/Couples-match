/// <reference lib="webworker" />
// Runs the engine off the main thread so typing, dragging and tapping never stall.
import { analyze } from './analysis';
import { explore } from './explore';
import { checkMove, computeFinalList } from './final-list';
import type { EngineRequest } from './engine-protocol';

self.onmessage = (e: MessageEvent<EngineRequest & { id: number }>) => {
  const { id, ...req } = e.data;
  try {
    self.postMessage({ id, result: handle(req) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

function handle(req: EngineRequest): unknown {
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
