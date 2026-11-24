import type { StoredSettings } from '@pairwise/db';
import { NRMP_RULES } from '@pairwise/engine';
import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { MapView } from './map-view';

export const metadata: Metadata = { title: 'Map of your list' };

export default async function MapPage() {
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  const settings = (ctx.couple.settings ?? {}) as StoredSettings;
  return (
    <MapView
      data={bundle.data}
      names={bundle.names}
      matchType={ctx.couple.match_type}
      listLength={settings.listLength ?? NRMP_RULES.maxRanksPerPartner}
    />
  );
}
