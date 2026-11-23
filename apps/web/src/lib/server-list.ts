import 'server-only';
import { buildEngineInput } from '@pairwise/db';
import { ENGINE_VERSION } from '@pairwise/engine';
import type { AppContext } from './context';
import { loadCoupleBundle } from './couple-data';
import { computeFinalList } from './final-list';
import { toVersionRows } from './versions';

/** The final list computed on the server (for saving versions and the printable page). */
export async function serverFinalList(ctx: AppContext & { couple: NonNullable<AppContext['couple']> }) {
  const bundle = await loadCoupleBundle(ctx);
  const list = computeFinalList(bundle.data, { names: bundle.names, matchType: ctx.couple.match_type });
  return {
    bundle,
    list,
    snapshot: {
      engine_version: ENGINE_VERSION,
      inputs_snapshot: buildEngineInput(bundle.data),
      pairs: toVersionRows(list.rows, list.length),
    },
  };
}
