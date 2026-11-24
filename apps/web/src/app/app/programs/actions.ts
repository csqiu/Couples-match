'use server';
import { revalidatePath } from 'next/cache';
import { DUPLICATE_RADIUS_MI } from '@pairwise/data';
import { haversineMi } from '@pairwise/engine';
import { requireCouple } from '@/lib/context';
import { geocode } from '@/lib/geocoder';
import { searchFilters } from '@/lib/program-search';
import { createClient } from '@/lib/supabase/server';
import { PROGRAM_COLUMNS, SEARCH_LIMIT, type ProgramLite } from './types';

/** Search programs in the couple's match by name, institution, city or NRMP code, optionally within one specialty and state. */
export async function searchPrograms(query: string, specialty: string, state = ''): Promise<{ results: ProgramLite[]; total: number }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  let q = supabase
    .from('programs')
    .select(PROGRAM_COLUMNS, { count: 'exact' })
    .eq('match_type', ctx.couple.match_type)
    .neq('specialty_code', 'no-match')
    .order('name')
    .limit(SEARCH_LIMIT);
  if (specialty) q = q.eq('specialty_code', specialty);
  if (/^[A-Z]{2}$/.test(state)) q = q.eq('state', state);
  for (const f of searchFilters(query)) q = q.or(f);
  const { data, count } = await q;
  return { results: (data ?? []) as ProgramLite[], total: count ?? 0 };
}

export async function addProgram(programId: string): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from('individual_ranks')
    .select('rank')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .order('rank', { ascending: false })
    .limit(1);
  const rank = (last?.[0]?.rank ?? 0) + 1;
  if (rank > 300) return { error: 'You can rank at most 300 programs.' };
  const { error } = await supabase
    .from('individual_ranks')
    .insert({ couple_id: ctx.couple.id, user_id: ctx.user.id, program_id: programId, rank, tier: 'B' });
  if (error && !error.message.includes('duplicate')) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}

export async function removeProgram(programId: string): Promise<{ error?: string }> {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { error } = await supabase
    .from('individual_ranks')
    .delete()
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.user.id)
    .eq('program_id', programId);
  if (error) return { error: error.message };
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
