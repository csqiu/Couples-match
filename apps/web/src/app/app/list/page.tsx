import type { StoredSettings } from '@pairwise/db';
import { NRMP_RULES } from '@pairwise/engine';
import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { ListView } from './list-view';

export const metadata: Metadata = { title: 'Final list' };

export default async function ListPage() {
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  const settings = (ctx.couple.settings ?? {}) as StoredSettings;
  return (
    <ListView
      data={bundle.data}
      names={bundle.names}
      matchType={ctx.couple.match_type}
      storedLength={settings.listLength ?? NRMP_RULES.maxRanksPerPartner}
    />
  );
}
