'use server';
import { isValidProgramCode, NRMP_RULES } from '@pairwise/engine';
import { revalidatePath } from 'next/cache';
import { requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';

export interface ListEntry {
  programId: string;
  tier: 'A' | 'B' | 'C';
  acceptable: boolean;
}

/**
 * Saves my whole list in one statement (ranks follow the given order: Tier A
 * first, then B, then C). Last write wins; the UI offers undo.
 */
export async function saveList(entries: ListEntry[]): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  if (entries.length > NRMP_RULES.maxRanksPerPartner) return { error: 'You can rank at most 300 programs.' };
  const order = { A: 0, B: 1, C: 2 } as const;
  const sorted = entries.map((e, i) => ({ ...e, i })).sort((a, b) => order[a.tier] - order[b.tier] || a.i - b.i);
  const supabase = await createClient();
  const { error } = await supabase.from('individual_ranks').upsert(
    sorted.map((e, idx) => ({
      couple_id: ctx.couple.id,
      user_id: ctx.user.id,
      program_id: e.programId,
      rank: idx + 1,
      tier: e.tier,
      acceptable: e.acceptable,
    })),
    { onConflict: 'couple_id,user_id,program_id' },
  );
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

export async function saveCode(programId: string, raw: string): Promise<{ error?: string }> {
  const code = raw.trim().toUpperCase();
  if (code && !isValidProgramCode(code)) return { error: 'NRMP codes are 9 or 10 characters, like 1234140C0.' };
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase
    .from('individual_ranks')
    .update({ nrmp_code: code || null })
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .eq('program_id', programId);
  return error ? { error: error.message } : {};
}
