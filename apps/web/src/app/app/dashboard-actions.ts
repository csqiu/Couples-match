'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCouple } from '@/lib/context';
import type { ListStep } from '@/lib/lists';
import { createClient } from '@/lib/supabase/server';

const STEPS: ListStep[] = ['rank', 'compare', 'conflicts', 'list'];

/** Opens another list for the couple (both partners), then goes to one of its steps. */
export async function openList(listId: string, step: ListStep): Promise<{ error?: string }> {
  await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.rpc('open_list', { p_list: listId });
  if (error) return { error: error.message === 'not_allowed' ? 'You can’t open that list.' : error.message };
  revalidatePath('/app', 'layout');
  redirect(`/app/${STEPS.includes(step) ? step : 'rank'}`);
}

/** Starts List N+1 (blank tiers, or a saved version's tiers) and opens it at the Rank step. */
export async function startList(name: string, fromVersion: string | null): Promise<{ error?: string }> {
  await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.rpc('start_list', {
    p_name: name.trim().slice(0, 120) || null,
    p_from_version: fromVersion || null,
  });
  if (error) return { error: error.message === 'not_allowed' ? 'You can’t start a list from that version.' : error.message };
  revalidatePath('/app', 'layout');
  redirect('/app/rank');
}

/** Stars or unstars a saved version (any number of versions can be starred). */
export async function setStar(versionId: string, starred: boolean): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.from('list_versions').update({ starred }).eq('id', versionId).eq('couple_id', ctx.couple.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}
