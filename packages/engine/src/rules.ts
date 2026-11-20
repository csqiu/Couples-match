/**
 * Every NRMP-specific number lives here. NRMP changes fees and limits, so this
 * file carries the year it applies to and the date it was last checked.
 *
 * VERIFICATION STATUS: NOT YET VERIFIED against nrmp.org. The values below come
 * from the product spec. nrmp.org was unreachable from the build environment;
 * see DECISIONS.md. Re-check every value before rank season and update
 * `lastVerified`.
 */
import type { MatchType } from './types';

export interface LengthFeeTier {
  minRanks: number;
  maxRanks: number;
  feeUsd: number;
}

export const NRMP_RULES = {
  rulesYear: 2027,
  /** ISO date the values were last checked against nrmp.org. null = never verified. */
  lastVerified: null as string | null,

  maxRanksPerPartner: 300,

  noMatchCode: {
    main: '999999999',
    sms_fellowship: '888888888',
  } satisfies Record<MatchType, string>,

  /** Unique program codes included in the base fee, per partner, No Match included. */
  includedUniqueCodes: 20,
  extraRankFeeUsd: 30,

  /** Length-of-list fee by number of ranks on the (pair) list. */
  lengthFeeTiers: [
    { minRanks: 100, maxRanks: 150, feeUsd: 50 },
    { minRanks: 151, maxRanks: 200, feeUsd: 100 },
    { minRanks: 201, maxRanks: 250, feeUsd: 150 },
    { minRanks: 251, maxRanks: 300, feeUsd: 200 },
  ] as LengthFeeTier[],

  couplesFeePerPartnerUsd: 45,

  /**
   * Format check only for codes typed by users from R3. NRMP program codes are
   * 9 characters (e.g. 1234140C0); No Match codes are 9 digits.
   */
  programCodePattern: /^[0-9]{7}[A-Z0-9][0-9]$/,

  sources: [
    { label: 'NRMP — Couples in the Match', url: 'https://www.nrmp.org/intro-to-the-match/the-match-algorithm/couples-in-the-match/' },
    { label: 'NRMP — Match Fees', url: 'https://www.nrmp.org/match-fees/' },
    { label: 'NRMP — How many programs can I rank?', url: 'https://www.nrmp.org/' },
  ],
} as const;

export function isValidProgramCode(code: string): boolean {
  return NRMP_RULES.programCodePattern.test(code.trim().toUpperCase());
}
