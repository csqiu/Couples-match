'use server';
import type { StoredSettings } from '@pairwise/db';
import type { EdgeReason } from '@pairwise/engine';
import { revalidatePath } from 'next/cache';
import { requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';

type Result = { error?: string };
const done = (error?: { message: string } | null): Result => {
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
};

/**
 * Breaks one link of a cycle. A pin is deleted (its answer stays, as a soft
 * answer); an automatic or rule link gets an exception scoped to these two pairs.
 */
export async function breakLink(link: { from: string; to: string; reasons: EdgeReason[] }): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const pins = link.reasons.filter((r): r is Extract<EdgeReason, { kind: 'pin' }> => r.kind === 'pin');
  if (pins.length) {
    const { error } = await supabase.from('pins').delete().eq('couple_id', ctx.couple.id).eq('higher_pair', link.from).eq('lower_pair', link.to);
    if (error) return { error: error.message };
    const comparisonIds = pins.flatMap((p) => (p.comparisonId ? [p.comparisonId] : []));
    if (comparisonIds.length) {
      const { error: e2 } = await supabase.from('comparisons').update({ locked: false }).in('id', comparisonIds).eq('couple_id', ctx.couple.id);
      if (e2) return { error: e2.message };
    }
  }
  if (link.reasons.some((r) => r.kind !== 'pin')) {
    const { error } = await supabase
      .from('rule_exceptions')
      .insert({ couple_id: ctx.couple.id, higher_pair: link.from, lower_pair: link.to, created_by: ctx.user.id });
    if (error && !error.message.includes('duplicate')) return { error: error.message };
  }
  return done();
}

export async function setTierAPriority(priority: 'partner1' | 'partner2' | 'case_by_case'): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const settings: StoredSettings = { ...((ctx.couple.settings ?? {}) as StoredSettings), tierAPriority: priority };
  const { error } = await supabase.from('couples').update({ settings: settings as never }).eq('id', ctx.couple.id);
  return done(error);
}

/** "Still true? Yes": lock the answer and make it a hard ordering. */
export async function confirmAnswer(id: string): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: c, error } = await supabase.from('comparisons').update({ locked: true }).eq('id', id).eq('couple_id', ctx.couple.id).select().single();
  if (error || !c) return { error: error?.message ?? 'Answer not found.' };
  if (c.winner !== 'tie') {
    const [higher, lower] = c.winner === 'left' ? [c.pair_left, c.pair_right] : [c.pair_right, c.pair_left];
    const { error: e2 } = await supabase
      .from('pins')
      .insert({ couple_id: ctx.couple.id, higher_pair: higher, lower_pair: lower, source: 'comparison', comparison_id: c.id, created_by: ctx.user.id });
    if (e2) return { error: e2.message };
  }
  return done();
}

/** "Actually, the other one." */
export async function flipAnswer(id: string): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: c } = await supabase.from('comparisons').select('winner').eq('id', id).eq('couple_id', ctx.couple.id).single();
  if (!c) return { error: 'Answer not found.' };
  const winner = c.winner === 'left' ? 'right' : c.winner === 'right' ? 'left' : 'tie';
  await supabase.from('pins').delete().eq('comparison_id', id);
  const { error } = await supabase.from('comparisons').update({ winner, locked: false }).eq('id', id).eq('couple_id', ctx.couple.id);
  return done(error);
}

export async function removeAnswer(id: string): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.from('comparisons').delete().eq('id', id).eq('couple_id', ctx.couple.id);
  return done(error);
}

/** Settles a disagreement from separate answering with one answer you both agree on. */
export async function resolveDisagreement(left: string, right: string, winner: 'left' | 'right' | 'tie'): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.from('comparisons').insert({
    couple_id: ctx.couple.id,
    pair_left: left,
    pair_right: right,
    winner,
    answered_by: ctx.user.id,
    both_agreed: true,
  });
  return done(error);
}
