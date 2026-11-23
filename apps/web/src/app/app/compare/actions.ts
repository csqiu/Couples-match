'use server';
import { revalidatePath } from 'next/cache';
import type { StoredSettings } from '@pairwise/db';
import { requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';

export interface AnswerInput {
  left: string;
  right: string;
  winner: 'left' | 'right' | 'tie';
  /** "I'm certain": also saves a hard ordering (pin). */
  certain: boolean;
}

/** Records my answer. Answering together counts for both partners immediately. */
export async function answer(input: AnswerInput): Promise<{ id?: string; error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const together = ((ctx.couple.settings ?? {}) as StoredSettings).answerMode !== 'separately';
  const certain = input.certain && input.winner !== 'tie';
  const { data, error } = await supabase
    .from('comparisons')
    .insert({
      couple_id: ctx.couple.id,
      pair_left: input.left,
      pair_right: input.right,
      winner: input.winner,
      answered_by: ctx.user.id,
      both_agreed: together,
      locked: certain,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not save your answer.' };
  if (certain) {
    const [higher, lower] = input.winner === 'left' ? [input.left, input.right] : [input.right, input.left];
    const { error: pinError } = await supabase
      .from('pins')
      .insert({ couple_id: ctx.couple.id, higher_pair: higher, lower_pair: lower, source: 'comparison', comparison_id: data.id, created_by: ctx.user.id });
    if (pinError) return { id: data.id, error: pinError.message };
  }
  revalidatePath('/app', 'layout');
  return { id: data.id };
}

/** Takes back an answer (its pin, if any, goes with it). */
export async function undoAnswer(id: string): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.from('comparisons').delete().eq('id', id).eq('couple_id', ctx.couple.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}
