/**
 * Controlled specialty vocabulary, mapped to the NRMP match each specialty is in.
 *
 * Couples must be in the same match: the Main Residency Match, or the same
 * Specialties Matching Service (SMS) fellowship match. Specialties that are not
 * in the NRMP at all (e.g. Urology via AUA, Ophthalmology via SF Match) are
 * listed with matchType 'other' so imports can recognise and set them aside.
 *
 * UNVERIFIED: SMS match names and memberships change between years. Check against
 * nrmp.org before relying on them (see DECISIONS.md).
 */
import type { MatchType } from '@pairwise/engine';

export type SpecialtyMatchType = MatchType | 'other';

export interface Specialty {
  code: string;
  name: string;
  matchType: SpecialtyMatchType;
  /** The specific match (e.g. "Main Residency Match", "Medicine and Pediatric Specialties"). */
  matchName: string;
  aliases: string[];
}

const MAIN = 'Main Residency Match';
const MPS = 'Medicine and Pediatric Specialties';

const main = (code: string, name: string, aliases: string[] = []): Specialty => ({
  code,
  name,
  matchType: 'main',
  matchName: MAIN,
  aliases,
});
const fellowship = (code: string, name: string, matchName: string, aliases: string[] = []): Specialty => ({
  code,
  name,
  matchType: 'sms_fellowship',
  matchName,
  aliases,
});
const other = (code: string, name: string, matchName: string, aliases: string[] = []): Specialty => ({
  code,
  name,
  matchType: 'other',
  matchName,
  aliases,
});

export const SPECIALTIES: Specialty[] = [
  // Main Residency Match
  main('anesthesiology', 'Anesthesiology', ['anesthesia']),
  main('child-neurology', 'Child Neurology', ['neurology - child', 'pediatric neurology']),
  main('dermatology', 'Dermatology'),
  main('emergency-medicine', 'Emergency Medicine', ['em', 'emergency med']),
  main('family-medicine', 'Family Medicine', ['family practice', 'fm']),
  main('internal-medicine', 'Internal Medicine', ['im', 'medicine', 'internal medicine - categorical', 'categorical medicine']),
  main('internal-medicine-pediatrics', 'Internal Medicine-Pediatrics', ['med-peds', 'medicine-pediatrics', 'im-peds', 'internal medicine/pediatrics']),
  main('interventional-radiology', 'Interventional Radiology - Integrated', ['ir', 'interventional radiology']),
  main('neurological-surgery', 'Neurological Surgery', ['neurosurgery']),
  main('neurology', 'Neurology'),
  main('obstetrics-gynecology', 'Obstetrics and Gynecology', ['ob/gyn', 'obgyn', 'ob-gyn', 'obstetrics & gynecology']),
  main('orthopaedic-surgery', 'Orthopaedic Surgery', ['orthopedic surgery', 'orthopedics', 'ortho']),
  main('otolaryngology', 'Otolaryngology - Head and Neck Surgery', ['ent', 'otolaryngology']),
  main('pathology', 'Pathology - Anatomic and Clinical', ['pathology', 'ap/cp']),
  main('pediatrics', 'Pediatrics', ['peds', 'pediatrics - categorical']),
  main('physical-medicine-rehabilitation', 'Physical Medicine and Rehabilitation', ['pm&r', 'pmr', 'physiatry']),
  main('plastic-surgery', 'Plastic Surgery - Integrated', ['plastic surgery', 'plastics']),
  main('psychiatry', 'Psychiatry', ['psych']),
  main('radiation-oncology', 'Radiation Oncology', ['rad onc']),
  main('diagnostic-radiology', 'Diagnostic Radiology', ['radiology', 'dr', 'radiology-diagnostic']),
  main('general-surgery', 'General Surgery', ['surgery', 'surgery - general', 'surgery - categorical']),
  main('thoracic-surgery', 'Thoracic Surgery - Integrated', ['cardiothoracic surgery', 'ct surgery']),
  main('vascular-surgery', 'Vascular Surgery - Integrated', ['vascular surgery']),
  main('transitional-year', 'Transitional Year', ['ty', 'transitional']),
  main('preliminary-medicine', 'Internal Medicine - Preliminary', ['prelim medicine', 'preliminary internal medicine']),
  main('preliminary-surgery', 'Surgery - Preliminary', ['prelim surgery', 'preliminary surgery']),
  main('medical-genetics', 'Medical Genetics and Genomics', ['medical genetics']),
  main('nuclear-medicine', 'Nuclear Medicine'),
  main('occupational-environmental-medicine', 'Occupational and Environmental Medicine', ['occupational & environmental med', 'occupational medicine']),
  main('preventive-medicine', 'Public Health and General Preventive Medicine', ['public health & preventive medicine', 'preventive medicine']),
  main('osteopathic-neuromusculoskeletal-medicine', 'Osteopathic Neuromusculoskeletal Medicine', ['onmm']),
  main('neurodevelopmental-disabilities', 'Neurodevelopmental Disabilities'),

  // Combined programs in the Main Residency Match (names as the NRMP directory spells them)
  main('aerospace-medicine-emergency-medicine', 'Aerospace Medicine/Emergency Medicine'),
  main('anesthesiology-emergency-medicine', 'Anesthesiology/Emergency Medicine'),
  main('dermatology-internal-medicine', 'Dermatology/Internal Medicine'),
  main('diagnostic-radiology-nuclear-medicine', 'Diagnostic Radiology/Nuclear Medicine'),
  main('emergency-medicine-family-medicine', 'Emergency Medicine/Family Medicine'),
  main('emergency-medicine-internal-medicine', 'Emergency Medicine/Internal Medicine'),
  main('family-medicine-preventive-medicine', 'Family Medicine/Preventive Medicine'),
  main('internal-medicine-aerospace-medicine', 'Internal Medicine/Aerospace Medicine'),
  main('internal-medicine-anesthesiology', 'Internal Medicine/Anesthesiology'),
  main('internal-medicine-medical-genetics', 'Internal Medicine/Medical Genetics'),
  main('internal-medicine-preventive-medicine', 'Internal Medicine/Preventive Medicine'),
  main('internal-medicine-psychiatry', 'Internal Medicine/Psychiatry'),
  main('medical-genetics-pediatrics', 'Medical Genetics and Genomics/Pediatrics'),
  main('pediatrics-anesthesiology', 'Pediatrics/Anesthesiology'),
  main('pediatrics-emergency-medicine', 'Pediatrics/Emergency Medicine'),
  main('pediatrics-physical-medicine-rehabilitation', 'Pediatrics/Physical Medicine and Rehabilitation', ['pediatrics/physical medicine & rehabilitation']),
  main('pediatrics-psychiatry-child-psychiatry', 'Pediatrics/Psychiatry/Child and Adolescent Psychiatry', ['pediatrics/psych/child psychiatry']),
  main('psychiatry-family-medicine', 'Psychiatry/Family Medicine'),
  main('psychiatry-neurology', 'Psychiatry/Neurology'),

  // SMS fellowships (illustrative subset; full list comes with the data import)
  fellowship('cardiovascular-disease', 'Cardiovascular Disease', MPS, ['cardiology', 'cards']),
  fellowship('gastroenterology', 'Gastroenterology', MPS, ['gi']),
  fellowship('pulmonary-critical-care', 'Pulmonary Disease and Critical Care Medicine', MPS, ['pulm/ccm', 'pccm', 'pulmonary critical care']),
  fellowship('hematology-oncology', 'Hematology and Medical Oncology', MPS, ['heme/onc', 'hem/onc', 'hematology oncology']),
  fellowship('nephrology', 'Nephrology', MPS, ['renal']),
  fellowship('infectious-disease', 'Infectious Disease', MPS, ['id']),
  fellowship('endocrinology', 'Endocrinology, Diabetes, and Metabolism', MPS, ['endocrine', 'endo']),
  fellowship('rheumatology', 'Rheumatology', MPS, ['rheum']),
  fellowship('pediatric-cardiology', 'Pediatric Cardiology', MPS, ['peds cards']),
  fellowship('pediatric-critical-care', 'Pediatric Critical Care Medicine', MPS, ['picu']),
  fellowship('pediatric-emergency-medicine', 'Pediatric Emergency Medicine', MPS, ['peds em', 'pem']),
  fellowship('neonatal-perinatal', 'Neonatal-Perinatal Medicine', MPS, ['neonatology', 'nicu']),
  fellowship('pediatric-hematology-oncology', 'Pediatric Hematology-Oncology', MPS, ['peds heme/onc']),

  // Not in the NRMP
  other('urology', 'Urology', 'AUA Urology Match'),
  other('ophthalmology', 'Ophthalmology', 'SF Match'),
];

const byCode = new Map(SPECIALTIES.map((s) => [s.code, s]));

function key(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const byKey = new Map<string, Specialty>();
for (const s of SPECIALTIES) {
  for (const label of [s.code, s.name, ...s.aliases]) byKey.set(key(label), s);
}

export function specialtyByCode(code: string): Specialty | undefined {
  return byCode.get(code);
}

/** Maps any spelling used by a source ("Medicine-Pediatrics", "OB/GYN") to the controlled vocabulary. */
export function normalizeSpecialty(raw: string): Specialty | undefined {
  return byKey.get(key(raw));
}

/** True when two specialties can be a couple in the same NRMP match. */
export function sameMatch(a: Specialty, b: Specialty): boolean {
  return a.matchType !== 'other' && a.matchType === b.matchType && a.matchName === b.matchName;
}
