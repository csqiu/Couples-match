import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { ConflictsView } from './conflicts-view';

export const metadata: Metadata = { title: 'Resolve conflicts' };

export default async function ConflictsPage() {
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  return (
    <ConflictsView
      data={bundle.data}
      me={bundle.me}
      names={bundle.names}
      role={ctx.role!}
      answerMode={bundle.answerMode}
      privateTiers={bundle.privateTiers}
    />
  );
}
