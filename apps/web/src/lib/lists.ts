/** Lists (fresh starts) and their numbered versions: labels and dashboard summaries. Pure. */

/** "2.3": list number, then the version's number within that list. */
export function versionLabel(listNumber: number, minor: number): string {
  return `${listNumber}.${minor}`;
}

/** "List 3 · After interviews", or "List 3" when unnamed. */
export function listTitle(list: { number: number; name: string | null }): string {
  return list.name ? `List ${list.number} · ${list.name}` : `List ${list.number}`;
}

/** The label of the version that saving now would create. */
export function nextVersionLabel(listNumber: number, versionsInList: number): string {
  return versionLabel(listNumber, versionsInList + 1);
}

/** Counts of a list's working state, from the live tables or a parked draft. */
export interface ListCounts {
  /** Programs per user id. */
  programs: Record<string, number>;
  answers: number;
  resolved: number;
}

interface DraftShape {
  ranks?: Array<{ userId?: string }>;
  comparisons?: unknown[];
  exceptions?: unknown[];
}

/** Counts from a parked list's draft (rank_lists.draft). */
export function countsFromDraft(draft: unknown): ListCounts {
  const d = (draft && typeof draft === 'object' ? draft : {}) as DraftShape;
  const programs: Record<string, number> = {};
  for (const r of d.ranks ?? []) if (r.userId) programs[r.userId] = (programs[r.userId] ?? 0) + 1;
  return { programs, answers: d.comparisons?.length ?? 0, resolved: d.exceptions?.length ?? 0 };
}

export type ListStep = 'rank' | 'compare' | 'conflicts' | 'list';

/** Where "Continue" takes the couple: the furthest step they've reached. */
export function continueStep(counts: ListCounts, versions: number): ListStep {
  if (versions > 0 || counts.answers >= 5) return 'list';
  if (counts.answers > 0) return 'compare';
  return 'rank';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One short status line per step, for a list card on the dashboard. */
export function stepStatus(
  counts: ListCounts,
  people: Array<{ id: string; name: string }>,
  latestPairs: number | null,
): Record<ListStep, string> {
  const ranked = people.filter((p) => (counts.programs[p.id] ?? 0) > 0);
  const rank =
    ranked.length === 0
      ? 'Not started'
      : people.length > 1 && ranked.length === people.length
        ? `Both ranked`
        : `${ranked.map((p) => p.name).join(' and ')} ranked`;
  return {
    rank,
    compare: counts.answers ? plural(counts.answers, 'answer') : 'No answers yet',
    conflicts: counts.resolved ? `${plural(counts.resolved, 'conflict')} resolved` : 'Check for conflicts',
    list: latestPairs == null ? 'Not saved yet' : `Last saved: ${plural(latestPairs, 'pair')}`,
  };
}
