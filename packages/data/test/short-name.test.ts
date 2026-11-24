import { describe, expect, it } from 'vitest';
import { shortProgramName } from '../src/short-name';

describe('shortProgramName', () => {
  it.each([
    ['Johns Hopkins Hosp — Plastic Surgery - Integrated', 'Hopkins Plastics'],
    ['MGB-Massachusetts Gen Hosp — Orthopaedic Surgery', 'MGH Ortho'],
    ['UC San Francisco — Internal Medicine (Fresno)', 'UCSF IM Fresno'],
    ['Univ of Alabama Hospital-Birmingham — Anesthesiology (track 2)', 'UAB Anesthesia #2'],
    ['Ohio State University Med Ctr — Internal Medicine/Psychiatry', 'Ohio State IM/Psych'],
    ['Hosp of the Univ of PA — Dermatology', 'Penn Derm'],
    ['Stony Brook Teach Hosps — Neurology', 'Stony Brook Neuro'],
  ])('%s → %s', (name, short) => expect(shortProgramName(name)).toBe(short));

  it('uses the database override when there is one', () => {
    expect(shortProgramName('Johns Hopkins Hosp — Dermatology', 'JH Derm')).toBe('JH Derm');
  });

  it('leaves names without an institution part alone', () => {
    expect(shortProgramName('No Match')).toBe('No Match');
  });
});
