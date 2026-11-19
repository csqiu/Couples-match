import { FEE_TIER_WARNING_MARGIN } from './defaults.js';
import { NRMP_RULES } from './rules.js';
import type { Pair } from './types.js';

export interface PartnerFees {
  uniqueCodes: number;
  extraCodes: number;
  extraRankFeeUsd: number;
  lengthFeeUsd: number;
  couplesFeeUsd: number;
  totalUsd: number;
}

export interface FeeEstimate {
  ranks: number;
  partners: [PartnerFees, PartnerFees];
  totalUsd: number;
  /** Set when trimming a few pairs would drop the list into a cheaper length tier. */
  tierWarning: { dropTo: number; pairsToCut: number; saveUsdPerPartner: number } | null;
}

/** Length-of-list fee for a list with this many ranks (per partner). */
export function lengthFeeUsd(ranks: number): number {
  for (const t of NRMP_RULES.lengthFeeTiers) if (ranks >= t.minRanks && ranks <= t.maxRanks) return t.feeUsd;
  return 0;
}

export function extraRankFeeUsd(uniqueCodes: number): number {
  return Math.max(0, uniqueCodes - NRMP_RULES.includedUniqueCodes) * NRMP_RULES.extraRankFeeUsd;
}

/** Fee estimate for a pair list (each partner's list has the same number of ranks). */
export function feeEstimate(pairs: Pair[]): FeeEstimate {
  const ranks = pairs.length;
  const partner = (k: 0 | 1): PartnerFees => {
    const uniqueCodes = new Set(pairs.map((p) => p.programs[k])).size; // No Match counts as a code.
    const extra = extraRankFeeUsd(uniqueCodes);
    const length = lengthFeeUsd(ranks);
    const couples = NRMP_RULES.couplesFeePerPartnerUsd;
    return {
      uniqueCodes,
      extraCodes: Math.max(0, uniqueCodes - NRMP_RULES.includedUniqueCodes),
      extraRankFeeUsd: extra,
      lengthFeeUsd: length,
      couplesFeeUsd: couples,
      totalUsd: extra + length + couples,
    };
  };
  const partners: [PartnerFees, PartnerFees] = [partner(0), partner(1)];

  let tierWarning: FeeEstimate['tierWarning'] = null;
  const current = lengthFeeUsd(ranks);
  if (current > 0) {
    const tier = NRMP_RULES.lengthFeeTiers.find((t) => ranks >= t.minRanks && ranks <= t.maxRanks)!;
    const dropTo = tier.minRanks - 1;
    const pairsToCut = ranks - dropTo;
    if (pairsToCut <= FEE_TIER_WARNING_MARGIN) {
      tierWarning = { dropTo, pairsToCut, saveUsdPerPartner: current - lengthFeeUsd(dropTo) };
    }
  }
  return { ranks, partners, totalUsd: partners[0].totalUsd + partners[1].totalUsd, tierWarning };
}
