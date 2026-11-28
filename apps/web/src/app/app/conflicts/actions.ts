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

/** What dropping a link changed, so Undo can put it back exactly (bug log #33). */
export interface LinkUndo {
  from: string;
  to: string;
  /** Pins that were deleted, with their original time (drags replay in that order). */
  pins: Array<{ source: 'comparison' | 'manual_drag' | 'conflict_resolution'; comparison_id: string | null; moved_pair: string | null; created_at: string }>;
  /** Answers that were unlocked. */
  unlocked: string[];
  /** An exception was added by this drop (not one that was already there). */
  excepted: boolean;
}

/**
 * Breaks one link of a cycle. A pin is deleted (its answer stays, as a soft
 * answer); an automatic or rule link gets an exception scoped to these two pairs.
 * Returns what changed, for Undo.
 */
export async function breakLink(link: { from: string; to: string; reasons: EdgeReason[] }): Promise<Result & { undo?: LinkUndo }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const undo: LinkUndo = { from: link.from, to: link.to, pins: [], unlocked: [], excepted: false };
  const pins = link.reasons.filter((r): r is Extract<EdgeReason, { kind: 'pin' }> => r.kind === 'pin');
  if (pins.length) {
    const { data: gone, error } = await supabase
      .from('pins')
      .delete()
      .eq('couple_id', ctx.couple.id)
      .eq('higher_pair', link.from)
      .eq('lower_pair', link.to)
      .select('source, comparison_id, moved_pair, created_at');
    if (error) return { error: error.message };
    undo.pins = (gone ?? []) as LinkUndo['pins'];
    const comparisonIds = pins.flatMap((p) => (p.comparisonId ? [p.comparisonId] : []));
    if (comparisonIds.length) {
      const { data: unlocked, error: e2 } = await supabase
        .from('comparisons')
        .update({ locked: false })
        .in('id', comparisonIds)
        .eq('couple_id', ctx.couple.id)
        .eq('locked', true)
        .select('id');
      if (e2) return { error: e2.message };
      undo.unlocked = (unlocked ?? []).map((c) => c.id);
    }
  }
  if (link.reasons.some((r) => r.kind !== 'pin')) {
    const { error } = await supabase
      .from('rule_exceptions')
      .insert({ couple_id: ctx.couple.id, higher_pair: link.from, lower_pair: link.to, created_by: ctx.user.id });
    if (error && !error.message.includes('duplicate')) return { error: error.message };
    undo.excepted = !error;
  }
  const res = done();
  return res.error ? res : { undo };
}

/** Undo of breakLink: the exception goes, deleted pins come back in their old place, answers relock. */
export async function restoreLink(undo: LinkUndo): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  if (undo.excepted) {
    const { error } = await supabase.from('rule_exceptions').delete().eq('couple_id', ctx.couple.id).eq('higher_pair', undo.from).eq('lower_pair', undo.to);
    if (error) return { error: error.message };
  }
  if (undo.pins.length) {
    const { error } = await supabase.from('pins').insert(
      undo.pins.map((p) => ({
        couple_id: ctx.couple.id,
        higher_pair: undo.from,
        lower_pair: undo.to,
        source: p.source,
        comparison_id: p.comparison_id,
        moved_pair: p.moved_pair,
        created_at: p.created_at,
        created_by: ctx.user.id,
      })),
    );
    if (error) return { error: error.message };
  }
  if (undo.unlocked.length) {
    const { error } = await supabase.from('comparisons').update({ locked: true }).in('id', undo.unlocked).eq('couple_id', ctx.couple.id);
    if (error) return { error: error.message };
  }
  return done();
}

/** "Set aside" list: a rule or answer link dropped earlier comes back (its exception goes). */
export async function bringBackLink(higher: string, lower: string): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.from('rule_exceptions').delete().eq('couple_id', ctx.couple.id).eq('higher_pair', higher).eq('lower_pair', lower);
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
