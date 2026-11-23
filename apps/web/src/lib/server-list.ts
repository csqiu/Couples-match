import 'server-only';
import { buildEngineInput } from '@pairwise/db';
import { ENGINE_VERSION } from '@pairwise/engine';
import type { AppContext } from './context';
import { loadCoupleBundle } from './couple-data';
import { computeFinalList } from './final-list';
import { toVersionRows } from './versions';

/** The final list computed on the server (for saving versions and the printable page). */
export async function serverFinalList(ctx: AppContext & { couple: NonNullable<AppContext['couple']> }, length?: number) {
  const bundle = await loadCoupleBundle(ctx);
  const list = computeFinalList(bundle.data, { names: bundle.names, matchType: ctx.couple.match_type });
  const n = Math.max(1, Math.min(list.rows.length, Math.round(length ?? list.length)));
  const input = buildEngineInput(bundle.data);
  return {
    bundle,
    list: { ...list, length: n },
    snapshot: {
      engine_version: ENGINE_VERSION,
      inputs_snapshot: { ...input, settings: { ...input.settings, listLength: n } },
      pairs: toVersionRows(list.rows, n),
    },
  };
}
