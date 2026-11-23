'use client';
import type { CoupleData } from '@pairwise/db';
import { useEffect, useRef, useState } from 'react';
import { analyze, type Analysis, type AnalyzeOptions } from './analysis';

/**
 * Runs the engine on the couple's data in a Web Worker (main thread as a fallback)
 * and re-runs whenever the data changes. Only the latest result is kept.
 */
export function useAnalysis(data: CoupleData, opts: AnalyzeOptions) {
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    try {
      worker.current = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker.current = null;
    }
    return () => worker.current?.terminate();
  }, []);

  const key = JSON.stringify([data, opts]);
  useEffect(() => {
    const id = ++seq.current;
    setBusy(true);
    const done = (r: Analysis | null, err?: string) => {
      if (id !== seq.current) return;
      if (r) setResult(r);
      setError(err ?? null);
      setBusy(false);
    };
    const w = worker.current;
    if (w) {
      const onMessage = (e: MessageEvent<{ id: number; result?: Analysis; error?: string }>) => {
        if (e.data.id === id) done(e.data.result ?? null, e.data.error);
      };
      w.addEventListener('message', onMessage);
      w.postMessage({ id, data, opts });
      return () => w.removeEventListener('message', onMessage);
    }
    // No worker support: run on the main thread after paint.
    const t = setTimeout(() => {
      try {
        done(analyze(data, opts));
      } catch (e) {
        done(null, e instanceof Error ? e.message : String(e));
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { result, error, busy };
}
