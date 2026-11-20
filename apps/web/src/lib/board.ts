/** Pure helpers for the rank-and-tier board (unit-tested in board.test.ts). */
export type Tier = 'A' | 'B' | 'C';
export const TIERS: Tier[] = ['A', 'B', 'C'];

export interface Item {
  programId: string;
  tier: Tier;
}

export type Board<T extends Item> = Record<Tier, T[]>;

export function group<T extends Item>(items: T[]): Board<T> {
  const b: Board<T> = { A: [], B: [], C: [] };
  for (const it of items) b[it.tier].push(it);
  return b;
}

/** Tier A first, then B, then C: the order that becomes ranks 1..n. */
export function flatten<T extends Item>(b: Board<T>): T[] {
  return TIERS.flatMap((t) => b[t].map((it) => ({ ...it, tier: t })));
}

export function findTier<T extends Item>(b: Board<T>, programId: string): Tier | null {
  return TIERS.find((t) => b[t].some((it) => it.programId === programId)) ?? null;
}

/** Moves an item to `toTier` at `index` (end if omitted). */
export function moveTo<T extends Item>(b: Board<T>, programId: string, toTier: Tier, index?: number): Board<T> {
  const from = findTier(b, programId);
  if (!from) return b;
  const item = b[from].find((it) => it.programId === programId)!;
  const next: Board<T> = { A: [...b.A], B: [...b.B], C: [...b.C] };
  next[from] = next[from].filter((it) => it.programId !== programId);
  const target = next[toTier];
  const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, { ...item, tier: toTier });
  return next;
}

/** Moves up/down by one place in the overall order, crossing into the neighbouring tier at the edges. */
export function nudge<T extends Item>(b: Board<T>, programId: string, dir: -1 | 1): Board<T> {
  const tier = findTier(b, programId);
  if (!tier) return b;
  const idx = b[tier].findIndex((it) => it.programId === programId);
  const ti = TIERS.indexOf(tier);
  if (dir === -1 && idx === 0) return ti === 0 ? b : moveTo(b, programId, TIERS[ti - 1]);
  if (dir === 1 && idx === b[tier].length - 1) return ti === 2 ? b : moveTo(b, programId, TIERS[ti + 1], 0);
  return moveTo(b, programId, tier, idx + dir);
}

export function sameOrder<T extends Item>(a: Board<T>, b: Board<T>): boolean {
  return TIERS.every((t) => a[t].length === b[t].length && a[t].every((it, i) => it.programId === b[t][i].programId));
}
