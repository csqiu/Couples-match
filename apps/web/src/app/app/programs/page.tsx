import type { StoredSettings } from '@pairwise/db';
import type { Metadata } from 'next';
import { displayName, requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { ProgramsView } from './programs-view';
import { PROGRAM_COLUMNS, type ProgramLite } from './types';

export const metadata: Metadata = { title: 'My programs' };

export default async function ProgramsPage() {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const partnerId = ctx.role === 'a' ? ctx.couple.partner_b : ctx.couple.partner_a;

  const [{ data: ranks }, { data: specialties }] = await Promise.all([
    supabase.from('individual_ranks').select(`user_id, rank, program:programs(${PROGRAM_COLUMNS})`).eq('couple_id', ctx.couple.id).order('rank'),
    supabase.from('specialties').select('code, name').eq('match_type', ctx.couple.match_type).eq('match_name', ctx.couple.match_name).order('name'),
  ]);
  const rows = (ranks ?? []) as unknown as Array<{ user_id: string; rank: number; program: ProgramLite }>;
  const mine = rows.filter((r) => r.user_id === ctx.user.id).map((r) => r.program);
  const partners = rows.filter((r) => r.user_id === partnerId).map((r) => r.program);

  // Show my specialty's programs first.
  const { data: initial } = await supabase
    .from('programs')
    .select(PROGRAM_COLUMNS)
    .eq('specialty_code', ctx.profile.specialty!)
    .order('name')
    .limit(60);

  return (
    <ProgramsView
      mySpecialty={ctx.profile.specialty!}
      specialties={specialties ?? []}
      initialResults={(initial ?? []) as ProgramLite[]}
      mine={mine}
      partners={partners}
      partnerName={partnerId ? displayName(ctx.partner) : null}
      privateTiers={((ctx.couple.settings ?? {}) as StoredSettings).privacy === 'private_tiers'}
    />
  );
}
