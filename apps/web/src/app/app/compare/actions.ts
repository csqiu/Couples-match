'use server';
import { revalidatePath } from 'next/cache';
import type { StoredSettings } from '@pairwise/db';
import { questionKey } from '@pairwise/engine';
import { requireCouple } from '@/lib/context';
import { updateCoupleSettings } from '@/lib/couple-settings';
import { createClient } from '@/lib/supabase/server';

export interface AnswerInput {
  left: string;
  right: string;
  winner: 'left' | 'right' | 'tie';
  /** "I'm certain": also saves a hard ordering (pin). */
  certain: boolean;
  /** Flag this question to discuss together (true), unflag it (false), or leave it (undefined). */
  flag?: boolean;
}

const PAIR = /^[^|]+\|[^|]+$/;

/** Adds or removes a question key from one of the settings lists. */
function withKey(list: string[] | undefined, key: string, on: boolean): string[] {
  const keys = new Set(list ?? []);
  if (on) keys.add(key);
  else keys.delete(key);
  return [...keys];
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
  // Answered: no longer waiting to come back to; flagged or unflagged as asked.
  const key = questionKey(input.left, input.right);
  const { error: settingsError } = await updateCoupleSettings((s) => ({
    ...s,
    deferredQuestions: withKey(s.deferredQuestions, key, false),
    ...(input.flag === undefined ? {} : { flaggedQuestions: withKey(s.flaggedQuestions, key, input.flag) }),
  }));
  if (settingsError) return { id: data.id, error: settingsError };
  return { id: data.id };
}

/** "Come back to this later": not asked again until the other questions run out. */
export async function deferQuestion(left: string, right: string, flag: boolean): Promise<{ error?: string }> {
  if (!PAIR.test(left) || !PAIR.test(right)) return { error: 'Unknown pair.' };
  const key = questionKey(left, right);
  return updateCoupleSettings((s) => ({
    ...s,
    deferredQuestions: withKey(s.deferredQuestions, key, true),
    flaggedQuestions: withKey(s.flaggedQuestions, key, flag),
  }));
}

/** Flags a question to discuss together, or unflags it. */
export async function setQuestionFlag(left: string, right: string, flag: boolean): Promise<{ error?: string }> {
  if (!PAIR.test(left) || !PAIR.test(right)) return { error: 'Unknown pair.' };
  return updateCoupleSettings((s) => ({ ...s, flaggedQuestions: withKey(s.flaggedQuestions, questionKey(left, right), flag) }));
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
