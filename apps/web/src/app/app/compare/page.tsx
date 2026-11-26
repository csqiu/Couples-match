import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { CompareView } from './compare-view';

export const metadata: Metadata = { title: 'This or that' };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ mode?: string; a?: string; b?: string }> }) {
  const { mode, a, b } = await searchParams;
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  return (
    <CompareView
      // A new ?mode, ?a or ?b starts the page afresh (links from the final list and flagged questions).
      key={`${mode ?? ''}|${a ?? ''}|${b ?? ''}`}
      data={bundle.data}
      me={bundle.me}
      names={bundle.names}
      role={ctx.role!}
      answerMode={bundle.answerMode}
      privateTiers={bundle.privateTiers}
      initialSpecific={mode === 'specific'}
      initialA={a ?? null}
      initialB={b ?? null}
    />
  );
}
