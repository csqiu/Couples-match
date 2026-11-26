import 'server-only';
import { buildEngineInput, type StoredSettings } from '@pairwise/db';
import { ENGINE_VERSION } from '@pairwise/engine';
import type { AppContext } from './context';
import { loadCoupleBundle } from './couple-data';
import { computeFinalList } from './final-list';
import { toVersionRows } from './versions';

/**
 * The final list computed on the server (for saving versions and the printable page).
 * `length` overrides the saved length setting (the slider may not have saved yet).
 * Only the first RANK_LIMIT rows are frozen: rows past NRMP's limit can't be submitted.
 */
export async function serverFinalList(ctx: AppContext & { couple: NonNullable<AppContext['couple']> }, length?: number) {
  const bundle = await loadCoupleBundle(ctx);
  const stored = (bundle.data.couple.settings ?? {}) as StoredSettings;
  const settings: StoredSettings = length == null ? stored : { ...stored, listLength: Math.round(length) };
  const data = { ...bundle.data, couple: { ...bundle.data.couple, settings: settings as never } };
  const list = computeFinalList(data, { names: bundle.names, matchType: ctx.couple.match_type });
  const input = buildEngineInput(data);
  return {
    bundle,
    list,
    snapshot: {
      engine_version: ENGINE_VERSION,
      // The list settings ride along in the snapshot, so restoring a version brings them back.
      inputs_snapshot: {
        ...input,
        settings: {
          ...input.settings,
          listLength: list.target,
          includedPairs: stored.includedPairs ?? [],
          noMatchUnlocked: !!stored.noMatchUnlocked,
          // How the list was shown, so a restore shows it the same way (bug log #37).
          ...(stored.listOrder ? { listOrder: stored.listOrder } : {}),
        },
      },
      pairs: toVersionRows(list.rows, list.length),
    },
  };
}
