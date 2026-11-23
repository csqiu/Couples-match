import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { CompareView } from './compare-view';

export const metadata: Metadata = { title: 'This or that' };

export default async function ComparePage() {
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  return (
    <CompareView
      data={bundle.data}
      me={bundle.me}
      names={bundle.names}
      role={ctx.role!}
      answerMode={bundle.answerMode}
      privateTiers={bundle.privateTiers}
    />
  );
}
