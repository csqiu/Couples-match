import { redirect } from 'next/navigation';
import { requireContext } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';

export default async function AppHome() {
  const ctx = await requireContext();
  if (!ctx.couple || !ctx.profile.specialty) redirect('/app/setup');
  const supabase = await createClient();
  const { count } = await supabase
    .from('individual_ranks')
    .select('program_id', { count: 'exact', head: true })
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id);
  redirect((count ?? 0) > 0 ? '/app/rank' : '/app/programs');
}
