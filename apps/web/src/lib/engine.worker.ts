/// <reference lib="webworker" />
// Runs the engine off the main thread so typing, dragging and tapping never stall.
import { analyze, type AnalyzeOptions } from './analysis';
import type { CoupleData } from '@pairwise/db';

self.onmessage = (e: MessageEvent<{ id: number; data: CoupleData; opts: AnalyzeOptions }>) => {
  const { id, data, opts } = e.data;
  try {
    self.postMessage({ id, result: analyze(data, opts) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
