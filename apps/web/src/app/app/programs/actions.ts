'use server';
import { revalidatePath } from 'next/cache';
import { requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { PROGRAM_COLUMNS, type ProgramLite } from './types';

/** Search programs in the couple's match by name, institution or city, optionally within one specialty. */
export async function searchPrograms(query: string, specialty: string): Promise<ProgramLite[]> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  let q = supabase
    .from('programs')
    .select(PROGRAM_COLUMNS)
    .eq('match_type', ctx.couple.match_type)
    .neq('specialty_code', 'no-match')
    .order('name')
    .limit(60);
  if (specialty) q = q.eq('specialty_code', specialty);
  // Keep only characters that are safe inside a PostgREST filter.
  const term = query.replace(/[^\p{L}\p{N}\s'.-]/gu, ' ').trim();
  if (term) {
    const like = `%${term.replace(/\s+/g, '%')}%`;
    q = q.or(`name.ilike.${like},institution.ilike.${like},city.ilike.${like},state.ilike.${like}`);
  }
  const { data } = await q;
  return (data ?? []) as ProgramLite[];
}

export async function addProgram(programId: string): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from('individual_ranks')
    .select('rank')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .order('rank', { ascending: false })
    .limit(1);
  const rank = (last?.[0]?.rank ?? 0) + 1;
  if (rank > 300) return { error: 'You can rank at most 300 programs.' };
  const { error } = await supabase
    .from('individual_ranks')
    .insert({ couple_id: ctx.couple.id, user_id: ctx.user.id, program_id: programId, rank, tier: 'B' });
  if (error && !error.message.includes('duplicate')) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

export async function removeProgram(programId: string): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase
    .from('individual_ranks')
    .delete()
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .eq('program_id', programId);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}
