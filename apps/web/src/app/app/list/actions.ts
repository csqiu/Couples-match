'use server';
import type { StoredSettings } from '@pairwise/db';
import { NRMP_RULES } from '@pairwise/engine';
import { revalidatePath } from 'next/cache';
import { requireCouple } from '@/lib/context';
import { serverFinalList } from '@/lib/server-list';
import { createClient } from '@/lib/supabase/server';

type Result = { error?: string; id?: string };

/** A manual drag the hard rules allow: saved as an ordering the couple asserted. */
export async function addDragPin(higher: string, lower: string): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pins')
    .insert({ couple_id: ctx.couple.id, higher_pair: higher, lower_pair: lower, source: 'manual_drag', created_by: ctx.user.id })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return { id: data.id };
}

export async function removePin(id: string): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase.from('pins').delete().eq('id', id).eq('couple_id', ctx.couple.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

export async function setListLength(length: number): Promise<Result> {
  const ctx = await requireCouple();
  const n = Math.max(1, Math.min(NRMP_RULES.maxRanksPerPartner, Math.round(length)));
  const settings: StoredSettings = { ...((ctx.couple.settings ?? {}) as StoredSettings), listLength: n };
  const supabase = await createClient();
  const { error } = await supabase.from('couples').update({ settings: settings as never }).eq('id', ctx.couple.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

/**
 * Freezes the current list: computed here on the server from the couple's rows,
 * with the exact engine inputs and version so it can be reproduced later.
 */
export async function saveVersion(name: string, note: string, length?: number): Promise<Result> {
  const ctx = await requireCouple();
  const clean = name.trim().slice(0, 120);
  if (!clean) return { error: 'Give the version a name.' };
  // Freeze exactly the length the couple is looking at (the slider may not have saved yet).
  const { snapshot } = await serverFinalList(ctx, length);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('list_versions')
    .insert({
      couple_id: ctx.couple.id,
      name: clean,
      note: note.trim() || null,
      created_by: ctx.user.id,
      engine_version: snapshot.engine_version,
      inputs_snapshot: snapshot.inputs_snapshot as never,
      pairs: snapshot.pairs as never,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return { id: data.id };
}
