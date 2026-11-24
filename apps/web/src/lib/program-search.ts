/**
 * Program search terms. The NRMP directory abbreviates heavily ("MGB-Massachusetts
 * Gen Hosp", "Univ of Maryland Med Ctr"), so each word the user types also
 * matches its usual abbreviations. Pure, so it's unit-tested.
 */
const ABBREVIATIONS: Record<string, string[]> = {
  general: ['gen'],
  hospital: ['hosp'],
  hospitals: ['hosps', 'hosp'],
  university: ['univ'],
  medical: ['med'],
  medicine: ['med'],
  center: ['ctr'],
  centre: ['ctr'],
  school: ['sch', 'som'],
  college: ['coll'],
  health: ['hlth'],
  saint: ['st'],
  st: ['saint'],
  childrens: ['children'],
  "children's": ['childrens', 'children'],
  system: ['sys'],
  memorial: ['mem'],
  regional: ['reg'],
  institute: ['inst'],
  national: ['natl'],
  massachusetts: ['mass'],
  mount: ['mt'],
  mt: ['mount'],
};

/** Words of a query, each with the spellings it may appear as. Characters unsafe in a PostgREST filter are dropped. */
export function searchTerms(query: string): string[][] {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'.-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ''))
    .filter((w) => w.length > 0 && !['of', 'the', 'and', 'at'].includes(w))
    .slice(0, 6);
  return words.map((w) => [...new Set([w, ...(ABBREVIATIONS[w] ?? [])])]);
}

/** One PostgREST `or` filter per word: the word (or an abbreviation) in any searchable field. */
export function searchFilters(query: string): string[] {
  const fields = ['name', 'institution', 'city', 'nrmp_code'];
  return searchTerms(query).map((variants) => variants.flatMap((v) => fields.map((f) => `${f}.ilike.%${v}%`)).join(','));
}
