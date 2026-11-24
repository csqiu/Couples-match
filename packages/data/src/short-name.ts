/**
 * Short program names for tight spaces ("Hopkins Plastics", "MGH Ortho", "UCSF IM").
 * A program's `short_name` in the database wins; otherwise one is derived from its
 * full name, which is "<institution> — <specialty>[ (<track>)]" for every program.
 */

/** Well-known institutions, matched against the start of the institution name (case-insensitive). */
const INSTITUTIONS: Array<[RegExp, string]> = [
  [/^johns hopkins/i, 'Hopkins'],
  [/^(mgb-)?massachusetts gen(eral)?\b/i, 'MGH'],
  [/^(mgb-)?brigham/i, 'BWH'],
  [/^(mgb-)?beth israel deaconess/i, 'BIDMC'],
  [/^boston children/i, 'Boston Children’s'],
  [/^(hosp(ital)? of the )?univ(ersity)? of (pa|pennsylvania)\b/i, 'Penn'],
  [/^(nyp|new ?york[- ]presbyterian)\b.*columbia/i, 'Columbia'],
  [/^(nyp|new ?york[- ]presbyterian)\b.*(weill|cornell)/i, 'Cornell'],
  [/^nyu\b/i, 'NYU'],
  [/^(isms?m|icahn).*mount sinai/i, 'Mount Sinai'],
  [/^mayo clinic/i, 'Mayo'],
  [/^cleveland clinic/i, 'Cleveland Clinic'],
  [/^uc ?san francisco|^univ(ersity)? of california,? san francisco/i, 'UCSF'],
  [/^ucla\b/i, 'UCLA'],
  [/^uc ?san diego/i, 'UCSD'],
  [/^uc ?davis/i, 'UC Davis'],
  [/^uc ?irvine/i, 'UC Irvine'],
  [/^stanford/i, 'Stanford'],
  [/^u(niv(ersity)?)? (of )?washington\b/i, 'UW'],
  [/^u texas southwestern|^ut southwestern/i, 'UTSW'],
  [/^baylor coll(ege)? (of )?med/i, 'Baylor'],
  [/^duke\b/i, 'Duke'],
  [/^yale/i, 'Yale'],
  [/^vanderbilt/i, 'Vanderbilt'],
  [/^emory/i, 'Emory'],
  [/^northwestern/i, 'Northwestern'],
  [/^barnes[- ]jewish|^washington univ/i, 'WashU'],
  [/^univ(ersity)? of michigan|^u michigan/i, 'Michigan'],
  [/^univ(ersity)? of chicago/i, 'UChicago'],
  [/^upmc\b/i, 'UPMC'],
  [/^u(niv(ersity)?)? (of )?north carolina\b|^unc\b/i, 'UNC'],
  [/^oregon health/i, 'OHSU'],
  [/^univ(ersity)? of alabama/i, 'UAB'],
  [/^med(ical)? coll(ege)? (of )?wisconsin/i, 'MCW'],
  [/^medical university of sc|^musc\b/i, 'MUSC'],
  [/^case western/i, 'Case Western'],
  [/^montefiore/i, 'Montefiore'],
  [/^rush\b/i, 'Rush'],
  [/^ohio state/i, 'Ohio State'],
  [/^penn state/i, 'Penn State'],
  [/^virginia commonwealth/i, 'VCU'],
  [/^u miami|^univ(ersity)? of miami/i, 'Miami'],
];

/** Words that only lengthen an institution name. */
const FILLER = new Set([
  'hosp', 'hosps', 'hospital', 'hospitals', 'med', 'medical', 'ctr', 'center', 'centre', 'health', 'healthcare', 'care',
  'system', 'sys', 'hlth', 'school', 'som', 'com', 'of', 'the', 'medicine', 'college', 'coll', 'affil', 'affiliated',
  'teach', 'teaching', 'program', 'programs', 'inc', 'corp', 'fdn', 'foundation', 'and', '&', 'clinics', 'gme', 'educ',
  'education', 'grad', 'main', 'campus', 'network',
]);

/** Specialty display names → the abbreviation residents use. */
const SPECIALTIES: Array<[RegExp, string]> = [
  [/^internal medicine[- ]+pediatrics$/i, 'Med-Peds'],
  [/^internal medicine - preliminary$/i, 'Prelim IM'],
  [/^surgery - preliminary$/i, 'Prelim Surg'],
  [/^internal medicine$/i, 'IM'],
  [/^general surgery$/i, 'Gen Surg'],
  [/^plastic surgery/i, 'Plastics'],
  [/^thoracic surgery/i, 'CT Surg'],
  [/^vascular surgery/i, 'Vascular'],
  [/^orthopaedic surgery$/i, 'Ortho'],
  [/^neurological surgery$/i, 'Neurosurg'],
  [/^otolaryngology/i, 'ENT'],
  [/^obstetrics and gynecology$/i, 'OB/GYN'],
  [/^emergency medicine$/i, 'EM'],
  [/^family medicine$/i, 'FM'],
  [/^pediatrics$/i, 'Peds'],
  [/^psychiatry$/i, 'Psych'],
  [/^child neurology$/i, 'Child Neuro'],
  [/^neurology$/i, 'Neuro'],
  [/^dermatology$/i, 'Derm'],
  [/^anesthesiology$/i, 'Anesthesia'],
  [/^diagnostic radiology$/i, 'Rads'],
  [/^interventional radiology/i, 'IR'],
  [/^radiation oncology$/i, 'Rad Onc'],
  [/^pathology/i, 'Path'],
  [/^physical medicine and rehabilitation$/i, 'PM&R'],
  [/^transitional year$/i, 'TY'],
  [/^medical genetics and genomics$/i, 'Genetics'],
  [/^nuclear medicine$/i, 'Nuc Med'],
];

const TRACKS: Record<string, string> = { Advanced: 'Adv', Preliminary: 'Prelim', 'Physician only': 'Res', 'Primary care': 'PC' };

/** "Ohio State University Med Ctr" → "Ohio State University"; at most three words. */
function shortInstitution(institution: string): string {
  const inst = institution.trim();
  for (const [re, short] of INSTITUTIONS) if (re.test(inst)) return short;
  const cleaned = inst
    .replace(/^MGB-/i, '')
    .split(/[/(]/)[0]
    .replace(/\bUniv(ersity)? of\b/gi, 'U')
    .replace(/\bUniversity\b|\bUniv\b/gi, '')
    .split(/[\s-]+/)
    .filter((w) => w && !FILLER.has(w.toLowerCase()));
  const words = cleaned.length ? cleaned : inst.split(/\s+/);
  return words.slice(0, 3).join(' ');
}

/** "Plastic Surgery - Integrated" → "Plastics"; combined programs abbreviate each part ("IM/Psych"). */
function shortSpecialty(specialty: string): string {
  const one = (s: string) => {
    const t = s.trim();
    for (const [re, short] of SPECIALTIES) if (re.test(t)) return short;
    return t.replace(/ - Integrated$/i, '');
  };
  return specialty.includes('/') ? specialty.split('/').map(one).join('/') : one(specialty);
}

/** "Advanced, track 2" → "Adv 2". */
function shortTrack(track: string): string {
  return track
    .split(',')
    .map((p) => p.trim())
    .map((p) => TRACKS[p] ?? p.replace(/^track (\d+)$/i, '#$1'))
    .join(' ');
}

/**
 * The short name for a program: its database override if it has one, else derived
 * from the full name. Names without " — " (user-added programs, No Match) only lose
 * filler words.
 */
export function shortProgramName(name: string, override?: string | null): string {
  if (override?.trim()) return override.trim();
  const [inst, rest] = name.split(' — ');
  if (!rest) return name;
  const m = /^(.*?)(?: \(([^)]*)\))*$/.exec(rest);
  // Track and city qualifiers come in parentheses at the end: "(Advanced, track 2) (Fresno)".
  const qualifiers = [...rest.matchAll(/\(([^)]*)\)/g)].map((x) => x[1]);
  const specialty = (m?.[1] ?? rest).replace(/\s*\([^)]*\)/g, '').trim();
  const extra = qualifiers.map((q) => (/^(Advanced|Preliminary|Physician only|Primary care|track \d+)/.test(q) ? shortTrack(q) : q));
  return [shortInstitution(inst), shortSpecialty(specialty), ...extra].filter(Boolean).join(' ');
}
