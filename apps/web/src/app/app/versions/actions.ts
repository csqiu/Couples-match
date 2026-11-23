'use server';
import { revalidatePath } from 'next/cache';
import { requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { saveVersion } from '../list/actions';

type Result = { error?: string };

export async function renameVersion(id: string, name: string, note: string): Promise<Result> {
  const ctx = await requireCouple();
  const clean = name.trim().slice(0, 120);
  if (!clean) return { error: 'A version needs a name.' };
  const supabase = await createClient();
  const { error } = await supabase.from('list_versions').update({ name: clean, note: note.trim() || null }).eq('id', id).eq('couple_id', ctx.couple.id);
  if (error) return { error: error.message };
  revalidatePath('/app/versions');
  return {};
}

/** Restores a version as the working draft. The current draft is saved as a version first. */
export async function restoreVersion(id: string, name: string): Promise<Result> {
  await requireCouple();
  const saved = await saveVersion(`Before restoring “${name}”`.slice(0, 120), 'Saved automatically before a restore.');
  if (saved.error) return { error: `Couldn’t save the current list first: ${saved.error}` };
  const supabase = await createClient();
  const { error } = await supabase.rpc('restore_version', { p_version: id });
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}
