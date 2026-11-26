import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { RankBoard, type BoardEntry } from './rank-board';

export const metadata: Metadata = { title: 'Rank and tier' };

export default async function RankPage() {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data } = await supabase
    .from('individual_ranks')
    .select('program_id, rank, tier, acceptable, nrmp_code, program:programs(name, city, state, nrmp_code)')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .order('rank');
  const entries: BoardEntry[] = (data ?? []).map((r) => {
    const p = r.program as unknown as { name: string; city: string; state: string; nrmp_code: string | null };
    return { programId: r.program_id, tier: r.tier, acceptable: r.acceptable, nrmpCode: r.nrmp_code ?? '', officialCode: p.nrmp_code ?? undefined, name: p.name, place: `${p.city}, ${p.state}` };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Rank and tier</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Order your programs from most to least preferred, and sort them into tiers. Drag the handle, or use the arrows and
            tier menu. Changes save automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/programs" className={buttonVariants({ variant: 'secondary' })}>Add programs</Link>
          {entries.length ? <Link href="/app/compare" className={buttonVariants()}>Next: compare</Link> : null}
        </div>
      </div>
      {entries.length ? (
        <>
          <RankBoard initial={entries} />
          <div className="flex justify-end">
            <Link href="/app/compare" className={buttonVariants()}>Next: compare</Link>
          </div>
        </>
      ) : (
        <div className="glass p-10 text-center">
          <p className="card-title">Your list is empty</p>
          <p className="mt-1 text-sm text-muted">Add the programs you’d be willing to go to first.</p>
          <Link href="/app/programs" className={buttonVariants({ className: 'mt-4' })}>Choose programs</Link>
        </div>
      )}
    </div>
  );
}
