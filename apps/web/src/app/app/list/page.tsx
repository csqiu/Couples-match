import type { StoredSettings } from '@pairwise/db';
import { NRMP_RULES } from '@pairwise/engine';
import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { nextVersionLabel } from '@/lib/lists';
import { createClient } from '@/lib/supabase/server';
import { ListView } from './list-view';

export const metadata: Metadata = { title: 'Final list' };

export default async function ListPage() {
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  const settings = (ctx.couple.settings ?? {}) as StoredSettings;
  const supabase = await createClient();
  const { count } = ctx.list
    ? await supabase.from('list_versions').select('id', { count: 'exact', head: true }).eq('list_id', ctx.list.id)
    : { count: 0 };
  return (
    <ListView
      data={bundle.data}
      names={bundle.names}
      matchType={ctx.couple.match_type}
      storedLength={settings.listLength ?? NRMP_RULES.maxRanksPerPartner}
      nextVersion={ctx.list ? nextVersionLabel(ctx.list.number, count ?? 0) : null}
    />
  );
}
