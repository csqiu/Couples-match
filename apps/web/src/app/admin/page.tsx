import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { buildQueue, REVIEW_COLUMNS, type ReviewProgram } from '@/lib/admin-review';
import { createClient } from '@/lib/supabase/server';
import { ReviewQueueView } from './review-queue';

export const metadata: Metadata = { title: 'Review programs' };

export default async function AdminReviewPage() {
  // Layouts and pages render in parallel, so each admin page checks for itself.
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: unverified }, { data: dups, error }] = await Promise.all([
    supabase.from('programs').select(REVIEW_COLUMNS).eq('verified', false).order('created_at').limit(1000),
    supabase.rpc('program_duplicates'),
  ]);
  if (error) throw new Error(error.message);
  const byId = new Map(((unverified ?? []) as ReviewProgram[]).map((p) => [p.id, p]));
  // Duplicate pairs can include verified programs; fetch the ones we don't have.
  const missing = [...new Set((dups ?? []).flatMap((d) => [d.program_a, d.program_b]))].filter((id) => !byId.has(id));
  if (missing.length) {
    const { data } = await supabase.from('programs').select(REVIEW_COLUMNS).in('id', missing);
    for (const p of (data ?? []) as ReviewProgram[]) byId.set(p.id, p);
  }
  const queue = buildQueue((unverified ?? []) as ReviewProgram[], dups ?? [], byId);
  return <ReviewQueueView queue={queue} />;
}
