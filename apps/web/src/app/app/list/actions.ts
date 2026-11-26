'use server';
import type { StoredSettings } from '@pairwise/db';
import { NRMP_RULES } from '@pairwise/engine';
import { revalidatePath } from 'next/cache';
import { requireCouple } from '@/lib/context';
import { versionLabel } from '@/lib/lists';
import { updateCoupleSettings } from '@/lib/couple-settings';
import { serverFinalList } from '@/lib/server-list';
import { createClient } from '@/lib/supabase/server';

type Result = { error?: string; id?: string; label?: string };

/**
 * A manual drag the hard rules allow: saved as an ordering the couple asserted, with
 * which pair they moved so the engine puts it exactly where it was dropped.
 */
export async function addDragPin(higher: string, lower: string, moved: 'higher' | 'lower' = 'higher'): Promise<Result> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pins')
    .insert({
      couple_id: ctx.couple.id,
      higher_pair: higher,
      lower_pair: lower,
      source: 'manual_drag',
      moved_pair: moved === 'lower' ? 'lower' : 'higher',
      created_by: ctx.user.id,
    })
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

const updateSettings = updateCoupleSettings;

export async function setListLength(length: number): Promise<Result> {
  const n = Math.max(1, Math.min(NRMP_RULES.maxRanksPerPartner, Math.round(length)));
  return updateSettings((s) => ({ ...s, listLength: n }));
}

/** Pairs added to the final list by hand (from "Not on your list"), or taken off again. */
export async function setIncluded(pairId: string, included: boolean): Promise<Result> {
  if (!/^[^|]+\|[^|]+$/.test(pairId)) return { error: 'Unknown pair.' };
  return updateSettings((s) => {
    const ids = new Set(s.includedPairs ?? []);
    if (included) ids.add(pairId);
    else ids.delete(pairId);
    return { ...s, includedPairs: [...ids] };
  });
}

/** How the final list is shown: tidied by a reading key, or the engine's own order. */
export async function setListOrder(order: NonNullable<StoredSettings['listOrder']>): Promise<Result> {
  if (!['partner1', 'partner2', 'balanced', 'engine'].includes(order)) return { error: 'Unknown order.' };
  return updateSettings((s) => ({ ...s, listOrder: order }));
}

/** After a restore: the pairs held off the list (programs added since that version) come in. */
export async function releaseHeldPrograms(): Promise<Result> {
  return updateSettings((s) => {
    const { heldPrograms: _h, ...rest } = s;
    return rest;
  });
}

/** Locked: the No Match rows stay at the end in their fixed order. Unlocked: they can be dragged. */
export async function setNoMatchUnlocked(unlocked: boolean): Promise<Result> {
  return updateSettings((s) => ({ ...s, noMatchUnlocked: unlocked }));
}

/**
 * Freezes the current list: computed here on the server from the couple's rows,
 * with the exact engine inputs and version so it can be reproduced later.
 */
export async function saveVersion(name: string, note: string, length?: number): Promise<Result> {
  const ctx = await requireCouple();
  const clean = name.trim().slice(0, 120) || 'Untitled';
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
    .select('id, minor, list:rank_lists!list_versions_list_id_fkey(number)')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  const listNumber = (data.list as unknown as { number: number } | null)?.number;
  return { id: data.id, label: listNumber ? versionLabel(listNumber, data.minor) : undefined };
}
