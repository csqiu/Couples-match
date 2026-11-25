import type { Metadata } from 'next';
import { requireCouple } from '@/lib/context';
import { loadCoupleBundle } from '@/lib/couple-data';
import { ExploreView } from './explore-view';

export const metadata: Metadata = { title: 'Explore comparisons' };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const ctx = await requireCouple();
  const bundle = await loadCoupleBundle(ctx);
  return <ExploreView data={bundle.data} me={bundle.me} names={bundle.names} answerMode={bundle.answerMode} initialA={a ?? null} initialB={b ?? null} />;
}
