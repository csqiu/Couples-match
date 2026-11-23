'use client';
import type { CoupleData } from '@pairwise/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalyzeOptions } from './analysis';
import { runLocally, type EngineRequest, type EngineResponse } from './engine-protocol';
import type { ListOptions } from './final-list';

type Pending = Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;

/** One engine Web Worker per page (main thread as a fallback), with request/response calls. */
export function useEngine() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef<Pending>(new Map());
  const seq = useRef(0);

  useEffect(() => {
    try {
      const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
        const p = pending.current.get(e.data.id);
        if (!p) return;
        pending.current.delete(e.data.id);
        if (e.data.error) p.reject(new Error(e.data.error));
        else p.resolve(e.data.result);
      };
      worker.current = w;
    } catch {
      worker.current = null;
    }
    return () => worker.current?.terminate();
  }, []);

  return useCallback(<R extends EngineRequest>(req: R): Promise<EngineResponse<R>> => {
    const w = worker.current;
    if (!w) {
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(runLocally(req) as EngineResponse<R>);
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        }, 0),
      );
    }
    const id = ++seq.current;
    return new Promise((resolve, reject) => {
      pending.current.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ id, ...req });
    });
  }, []);
}

/** Re-runs one engine request whenever its inputs change; keeps only the latest result. */
function useEngineResult<T>(makeRequest: () => EngineRequest, key: string) {
  const call = useEngine();
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setBusy(true);
    call(makeRequest())
      .then((r) => {
        if (id !== latest.current) return;
        setResult(r as T);
        setError(null);
      })
      .catch((e: Error) => id === latest.current && setError(e.message))
      .finally(() => id === latest.current && setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, call]);

  return { result, error, busy };
}

export function useAnalysis(data: CoupleData, opts: AnalyzeOptions) {
  return useEngineResult<import('./analysis').Analysis>(() => ({ kind: 'analyze', data, opts }), JSON.stringify(['a', data, opts]));
}

export function useFinalList(data: CoupleData, opts: ListOptions) {
  return useEngineResult<import('./final-list').FinalList>(() => ({ kind: 'list', data, opts }), JSON.stringify(['l', data, opts]));
}
