'use server';
import { revalidatePath } from 'next/cache';
import { DUPLICATE_RADIUS_MI } from '@pairwise/data';
import { haversineMi, NRMP_RULES } from '@pairwise/engine';
import { requireCouple } from '@/lib/context';
import { geocode } from '@/lib/geocoder';
import { searchFilters } from '@/lib/program-search';
import { createClient } from '@/lib/supabase/server';
import { PROGRAM_COLUMNS, SEARCH_LIMIT, type ProgramLite } from './types';

/** Search programs in the couple's match by name, institution, city or NRMP code, optionally within one specialty and state. */
export async function searchPrograms(query: string, specialty: string, state = '', offset = 0): Promise<{ results: ProgramLite[]; total: number }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  let q = supabase
    .from('programs')
    .select(PROGRAM_COLUMNS, { count: 'exact' })
    .eq('match_type', ctx.couple.match_type)
    .neq('specialty_code', 'no-match')
    .order('name')
    .order('id')
    .range(Math.max(0, offset), Math.max(0, offset) + SEARCH_LIMIT - 1);
  if (specialty) q = q.eq('specialty_code', specialty);
  if (/^[A-Z]{2}$/.test(state)) q = q.eq('state', state);
  for (const f of searchFilters(query)) q = q.or(f);
  const { data, count } = await q;
  return { results: (data ?? []) as ProgramLite[], total: count ?? 0 };
}

/**
 * Renumbers my list 1..n in its current order. Removing a program leaves a gap; without
 * this, "highest rank + 1" would creep past 300 while fewer than 300 programs are listed.
 * One upsert, so the deferrable unique constraint on rank is checked once.
 */
async function compactRanks(supabase: Awaited<ReturnType<typeof createClient>>, coupleId: string, userId: string) {
  const { data: rows } = await supabase
    .from('individual_ranks')
    .select('program_id, rank, tier, acceptable')
    .eq('couple_id', coupleId)
    .eq('user_id', userId)
    .order('rank');
  const list = rows ?? [];
  if (list.every((r, i) => r.rank === i + 1)) return list.length;
  const { error } = await supabase.from('individual_ranks').upsert(
    list.map((r, i) => ({ couple_id: coupleId, user_id: userId, program_id: r.program_id, rank: i + 1, tier: r.tier, acceptable: r.acceptable })),
    { onConflict: 'couple_id,user_id,program_id' },
  );
  if (error) throw new Error(error.message);
  return list.length;
}

export async function addProgram(programId: string): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  let count: number;
  try {
    count = await compactRanks(supabase, ctx.couple.id, ctx.user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (count >= NRMP_RULES.maxRanksPerPartner) return { error: `You can rank at most ${NRMP_RULES.maxRanksPerPartner} programs.` };
  const { error } = await supabase
    .from('individual_ranks')
    .insert({ couple_id: ctx.couple.id, user_id: ctx.user.id, program_id: programId, rank: count + 1, tier: 'B' });
  if (error && !error.message.includes('duplicate')) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

/** My own short name for a program on my list. Blank goes back to the automatic one. */
export async function saveShortName(programId: string, raw: string): Promise<{ error?: string }> {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length > 40) return { error: 'Keep it to 40 characters.' };
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase
    .from('individual_ranks')
    .update({ short_name: name || null })
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .eq('program_id', programId);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

/** A removed row, everything about it, so Undo can put it back exactly. */
export interface RemovedRank {
  program_id: string;
  rank: number;
  tier: 'A' | 'B' | 'C';
  acceptable: boolean;
  note: string | null;
  nrmp_code: string | null;
  short_name: string | null;
}

export async function removeProgram(programId: string): Promise<{ error?: string; removed?: RemovedRank }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('individual_ranks')
    .delete()
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .eq('program_id', programId)
    .select('program_id, rank, tier, acceptable, note, nrmp_code, short_name');
  if (error) return { error: error.message };
  try {
    await compactRanks(supabase, ctx.couple.id, ctx.user.id);
  } catch {
    // The gap is harmless until the next add, which compacts again.
  }
  revalidatePath('/app', 'layout');
  return { removed: (data?.[0] as RemovedRank | undefined) ?? undefined };
}

/** Undo a removal: the row comes back with its tier, note, code and short name, at its old place. */
export async function restoreRemoved(row: RemovedRank): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  let count: number;
  try {
    count = await compactRanks(supabase, ctx.couple.id, ctx.user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (count >= NRMP_RULES.maxRanksPerPartner) return { error: `You can rank at most ${NRMP_RULES.maxRanksPerPartner} programs.` };
  const { error } = await supabase.from('individual_ranks').insert({
    couple_id: ctx.couple.id,
    user_id: ctx.user.id,
    program_id: row.program_id,
    rank: count + 1,
    tier: row.tier,
    acceptable: row.acceptable,
    note: row.note,
    nrmp_code: row.nrmp_code,
    short_name: row.short_name,
  });
  if (error && !error.message.includes('duplicate')) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

export interface NewProgram {
  name: string;
  institution: string;
  specialty: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  /** The couple saw "we couldn't find that address" and wants to save it anyway. */
  allowNoLocation?: boolean;
  /** The couple saw the similar programs and says theirs isn't one of them. */
  notADuplicate?: boolean;
}

export type NewProgramResult =
  | { status: 'added'; program: ProgramLite }
  | { status: 'not_found' }
  | { status: 'similar'; similar: Array<ProgramLite & { distanceMi: number }> }
  | { status: 'error'; error: string };

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * "Add a program not listed": finds the address on the map, offers close matches
 * that are already listed, then saves the program privately for this couple
 * (an admin reviews it before anyone else sees it) and adds it to my list.
 */
export async function addNewProgram(input: NewProgram): Promise<NewProgramResult> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const name = clean(input.name, 200);
  const institution = clean(input.institution, 200) || name;
  const street = clean(input.street, 200);
  const city = clean(input.city, 100);
  const state = clean(input.state, 2).toUpperCase();
  const zip = clean(input.zip, 10);
  if (name.length < 3) return { status: 'error', error: 'Enter the program’s name.' };
  if (!city) return { status: 'error', error: 'Enter the city.' };
  if (!/^[A-Z]{2}$/.test(state)) return { status: 'error', error: 'Enter the state as two letters, like MA.' };
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) return { status: 'error', error: 'The ZIP code should be 5 digits.' };

  const { data: specialty } = await supabase.from('specialties').select('*').eq('code', input.specialty).single();
  if (!specialty || specialty.match_type !== ctx.couple.match_type || specialty.match_name !== ctx.couple.match_name) {
    return { status: 'error', error: 'Choose a specialty in your match.' };
  }

  const geo = await geocode({ street, city, state, zip: zip || undefined });
  if (!geo && !input.allowNoLocation) return { status: 'not_found' };

  if (geo && !input.notADuplicate) {
    const { data: nearby } = await supabase
      .from('programs')
      .select(PROGRAM_COLUMNS)
      .eq('specialty_code', specialty.code)
      .eq('state', state)
      .not('lat', 'is', null);
    const similar = ((nearby ?? []) as ProgramLite[])
      .map((p) => ({ ...p, distanceMi: haversineMi({ lat: p.lat!, lon: p.lon! }, geo) }))
      .filter((p) => p.distanceMi <= DUPLICATE_RADIUS_MI)
      .sort((a, b) => a.distanceMi - b.distanceMi)
      .slice(0, 5);
    if (similar.length) return { status: 'similar', similar };
  }

  const { data: program, error } = await supabase
    .from('programs')
    .insert({
      name,
      institution,
      specialty_code: specialty.code,
      specialty_name: specialty.name,
      match_type: ctx.couple.match_type,
      match_name: ctx.couple.match_name,
      city,
      state,
      address: [street, city, `${state}${zip ? ` ${zip}` : ''}`].filter(Boolean).join(', '),
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      geocode_confidence: geo?.confidence ?? null,
      geocode_source: geo?.source ?? null,
      source: 'user',
      verified: false,
      created_by_couple: ctx.couple.id,
    })
    .select(PROGRAM_COLUMNS)
    .single();
  if (error || !program) return { status: 'error', error: error?.message ?? 'Couldn’t save the program.' };
  const added = await addProgram(program.id);
  if (added.error) return { status: 'error', error: added.error };
  return { status: 'added', program: program as ProgramLite };
}

/** Brings back the list saved when your last couple ended (only into an empty list). */
export async function restoreSavedList(): Promise<{ count?: number; error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('restore_saved_rank_list', { p_couple: ctx.couple.id });
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return { count: data ?? 0 };
}
