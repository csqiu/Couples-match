'use server';
import { importPrograms, parseCsv, type ProgramRecord, type StagingRow } from '@pairwise/data';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { parseAddress, REVIEW_COLUMNS, type ReviewProgram } from '@/lib/admin-review';
import { geocode } from '@/lib/geocoder';
import { createClient } from '@/lib/supabase/server';

type Result = { error?: string };

const done = (error?: { message: string } | null): Result => {
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return {};
};

/** Approving makes a program global: every couple in its match can find it. */
export async function approvePrograms(ids: string[]): Promise<Result> {
  await requireAdmin();
  if (!ids.length) return {};
  const supabase = await createClient();
  const { error } = await supabase.from('programs').update({ verified: true, created_by_couple: null }).in('id', ids.slice(0, 1000));
  return done(error);
}

export interface ProgramEdit {
  name: string;
  institution: string;
  address: string;
  city: string;
  state: string;
}

export async function editProgram(id: string, edit: ProgramEdit): Promise<Result> {
  await requireAdmin();
  const name = edit.name.trim();
  const state = edit.state.trim().toUpperCase();
  if (name.length < 3) return { error: 'Enter a name.' };
  if (!/^[A-Z]{2}$/.test(state)) return { error: 'State should be two letters.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('programs')
    .update({ name, institution: edit.institution.trim() || name, address: edit.address.trim(), city: edit.city.trim(), state })
    .eq('id', id);
  return done(error);
}

/** Looks the program's address up again (after fixing it, say). */
export async function relocateProgram(id: string): Promise<Result & { confidence?: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: p } = await supabase.from('programs').select(REVIEW_COLUMNS).eq('id', id).single();
  if (!p) return { error: 'Program not found.' };
  const geo = await geocode(parseAddress(p as ReviewProgram));
  if (!geo) return { error: 'Neither geocoder could find that address. Fix the address, or set the location by hand.' };
  const { error } = await supabase
    .from('programs')
    .update({ lat: geo.lat, lon: geo.lon, geocode_confidence: geo.confidence, geocode_source: geo.source })
    .eq('id', id);
  return { ...done(error), confidence: geo.confidence };
}

/** Sets the location by hand, e.g. from a point copied out of a map app. Hand-set locations survive re-imports. */
export async function setLocation(id: string, lat: number, lon: number): Promise<Result> {
  await requireAdmin();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 17 || lat > 72 || lon < -180 || lon > -64) {
    return { error: 'That doesn’t look like a US location. Paste it as “latitude, longitude”, e.g. 42.3625, -71.0698.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('programs').update({ lat, lon, geocode_confidence: 1, geocode_source: 'manual' }).eq('id', id);
  return done(error);
}

const MERGE_ERRORS: Record<string, string> = {
  program_wrong_match: 'Those programs are in different matches.',
  program_not_available: 'You can’t merge into another couple’s private program. Approve it first.',
  program_not_found: 'One of the programs no longer exists.',
  same_program: 'Pick a different program.',
};

/** Folds `from` into `to`; every couple's ranks and answers move across. */
export async function mergePrograms(from: string, to: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_programs', { p_from: from, p_to: to });
  if (error) return { error: MERGE_ERRORS[error.message] ?? error.message };
  return done(null);
}

/** Programs to merge into: same specialty, matching the query. */
export async function findMergeTargets(query: string, specialty: string, exclude: string): Promise<ReviewProgram[]> {
  await requireAdmin();
  const supabase = await createClient();
  let q = supabase.from('programs').select(REVIEW_COLUMNS).eq('specialty_code', specialty).neq('id', exclude).order('name').limit(20);
  const term = query.replace(/[^\p{L}\p{N}\s'.-]/gu, ' ').trim();
  if (term) {
    const like = `%${term.replace(/\s+/g, '%')}%`;
    q = q.or(`name.ilike.${like},institution.ilike.${like},city.ilike.${like}`);
  }
  const { data } = await q;
  return (data ?? []) as ReviewProgram[];
}

// ---------------------------------------------------------------------------
// CSV import

/** Most rows go to the Census geocoder at about a second each, so keep uploads to a size a page can wait for. */
const MAX_IMPORT_ROWS = 300;

export interface ImportPreview {
  error?: string;
  rows: number;
  /** New or updated programs, ready to save. */
  programs: Array<ProgramRecord & { isUpdate: boolean; reasons: string[] }>;
  /** Rows that look like programs already listed; not saved (merge or fix by hand). */
  duplicates: Array<{ program: ProgramRecord; duplicateOf: string }>;
  rejected: Array<{ line: number; name: string; reason: string }>;
}

const REJECT_LABEL: Record<string, string> = {
  missing_fields: 'Missing a name, specialty, city or state',
  unknown_specialty: 'Specialty not recognised',
  not_in_nrmp: 'Specialty isn’t in an NRMP match',
};

const REQUIRED_COLUMNS = ['name', 'specialty', 'city', 'state'];

/** Step 1: read the CSV, normalise and geocode every row, and show what would change. Nothing is saved. */
export async function previewImport(csv: string, source: string): Promise<ImportPreview> {
  await requireAdmin();
  const empty: ImportPreview = { rows: 0, programs: [], duplicates: [], rejected: [] };
  const table = parseCsv(csv);
  if (!table.length) return { ...empty, error: 'The file has no rows.' };
  const missing = REQUIRED_COLUMNS.filter((c) => !(c in table[0]));
  if (missing.length) return { ...empty, error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` };
  if (table.length > MAX_IMPORT_ROWS) {
    return { ...empty, rows: table.length, error: `That’s ${table.length} rows. Upload at most ${MAX_IMPORT_ROWS} at a time (split the file).` };
  }
  const src = source.trim().replace(/[^\w.-]+/g, '-').slice(0, 60) || 'admin-upload';
  const rows: StagingRow[] = table.map((r) => ({
    source: src,
    sourceId: r.source_id || undefined,
    name: r.name ?? '',
    institution: r.institution || r.name || '',
    specialty: r.specialty ?? '',
    street: r.street ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    zip: r.zip || undefined,
    acgmeId: r.acgme_id || undefined,
    isAdvanced: /^(1|true|yes|y)$/i.test(r.is_advanced ?? ''),
  }));

  const supabase = await createClient();
  // Every global program, a page at a time (Supabase returns at most 1,000 rows per request).
  const existingRows: Array<{ id: string; name: string; institution: string; specialty_code: string; lat: number | null; lon: number | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase
      .from('programs')
      .select('id, name, institution, specialty_code, lat, lon')
      .is('created_by_couple', null)
      .order('id')
      .range(from, from + 999);
    if (error) return { ...empty, error: error.message };
    existingRows.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const existingIds = new Set(existingRows.map((p) => p.id));
  // Existing programs, shaped just enough for the pipeline's duplicate check.
  const existing = existingRows.map((p) => ({ id: p.id, name: p.name, institution: p.institution, specialtyCode: p.specialty_code, lat: p.lat, lon: p.lon })) as ProgramRecord[];

  // Metro areas are assigned by the database (from its boundary table), not here.
  const result = await importPrograms(rows, { geocoder: { geocode }, existing });
  const reasonsById = new Map(result.review.map((r) => [r.program.id, r.reasons.filter((x) => x !== 'possible_duplicate') as string[]]));
  // A row whose id is already in the database is an update, not a duplicate.
  const updates = new Map(
    result.review.filter((r) => r.duplicateOf === r.program.id && existingIds.has(r.program.id)).map((r) => [r.program.id, r.program]),
  );
  return {
    rows: rows.length,
    programs: [...result.programs, ...updates.values()].map((p) => ({ ...p, isUpdate: existingIds.has(p.id), reasons: reasonsById.get(p.id) ?? [] })),
    duplicates: result.review
      .filter((r) => r.duplicateOf && r.duplicateOf !== r.program.id)
      .map((r) => ({ program: r.program, duplicateOf: r.duplicateOf! })),
    rejected: result.rejected.map((r) => ({
      line: rows.indexOf(r.row) + 2, // + header row, 1-based
      name: r.row.name || '(no name)',
      reason: REJECT_LABEL[r.reason] ?? r.reason,
    })),
  };
}

/** Step 2: save the previewed programs. */
export async function commitImport(programs: ProgramRecord[]): Promise<Result & { inserted?: number; updated?: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_programs', { p_programs: programs as unknown as never });
  if (error) return { error: error.message === 'bad_input' ? 'Some rows can’t be imported (they clash with a couple’s own program).' : error.message };
  revalidatePath('/admin', 'layout');
  return { inserted: data?.[0]?.inserted ?? 0, updated: data?.[0]?.updated ?? 0 };
}
