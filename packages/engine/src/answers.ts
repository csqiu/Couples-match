/**
 * Which of the couple's answers count (Section 5.6). Shared by learning, the
 * constraint graph and conflict detection.
 */
import type { Comparison, PairId } from './types';

export function unorderedKey(a: PairId, b: PairId): string {
  return a < b ? `${a}#${b}` : `${b}#${a}`;
}

/** Winner expressed as the pair that won, or null for a tie. */
export function winningPair(c: Comparison): PairId | null {
  return c.winner === 'tie' ? null : c.winner === 'left' ? c.left : c.right;
}

/**
 * Comparisons that count, plus disagreements that don't (yet).
 * - An answer marked bothAgreed settles its question.
 * - Otherwise, if two different people answered the same question differently, it is a disagreement.
 * - Otherwise the latest answer counts.
 */
export function effectiveComparisons(comparisons: Comparison[]): { counted: Comparison[]; disagreements: Comparison[][] } {
  const groups = new Map<string, Comparison[]>();
  for (const c of comparisons) {
    const k = unorderedKey(c.left, c.right);
    const list = groups.get(k);
    if (list) list.push(c);
    else groups.set(k, [c]);
  }
  const counted: Comparison[] = [];
  const disagreements: Comparison[][] = [];
  const latest = (cs: Comparison[]) =>
    cs.reduce((a, b) => ((b.seq ?? 0) >= (a.seq ?? 0) ? b : a));

  for (const group of groups.values()) {
    const agreed = group.filter((c) => c.bothAgreed);
    if (agreed.length) {
      counted.push(latest(agreed));
      continue;
    }
    // Latest answer per person.
    const byPerson = new Map<string, Comparison>();
    for (const c of group) {
      const who = c.answeredBy ?? '';
      const prev = byPerson.get(who);
      if (!prev || (c.seq ?? 0) >= (prev.seq ?? 0)) byPerson.set(who, c);
    }
    const answers = [...byPerson.values()];
    const winners = new Set(answers.map(winningPair));
    if (answers.length > 1 && winners.size > 1) disagreements.push(answers);
    else counted.push(latest(answers));
  }
  return { counted, disagreements };
}

