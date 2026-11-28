import 'server-only';
import type { StoredSettings } from '@pairwise/db';
import { revalidatePath } from 'next/cache';
import { requireCouple } from './context';
import { createClient } from './supabase/server';

/**
 * Read-modify-write of the couple's settings. Reads the latest copy first, so a
 * partner's change to another field isn't overwritten.
 */
export async function updateCoupleSettings(change: (s: StoredSettings) => StoredSettings): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: row } = await supabase.from('couples').select('settings').eq('id', ctx.couple.id).single();
  const settings = change({ ...(((row?.settings ?? ctx.couple.settings) ?? {}) as StoredSettings) });
  const { error } = await supabase.from('couples').update({ settings: settings as never }).eq('id', ctx.couple.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}
