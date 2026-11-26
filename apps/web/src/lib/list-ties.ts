/**
 * What holds a row in place on the final list: the nearest row that must stay above it and
 * the nearest that must stay below it (an answer, a drag, a Tier A rule, or the automatic
 * "better for both" rule). Drawn as brackets beside a selected or dragged row. Pure, so the
 * worker builds the ties and the page works out the brackets for any order while dragging.
 */

/** Where a tie comes from. `tier0` / `tier1` = that partner's Tier A rule. */
export type TieSource = 'drag' | 'answer' | 'choice' | 'tier0' | 'tier1' | 'auto';

export interface ListTies {
  /** `higher` must stay above `lower`. */
  links: Array<{ higher: string; lower: string; source: TieSource }>;
  /** Every pair in `tops` must stay above every pair in `bottoms` (a Tier A rule). */
  groups: Array<{ source: TieSource; tops: string[]; bottoms: string[] }>;
}

/** Better labels first, when two rows are tied for more than one reason. */
const PRIORITY: TieSource[] = ['drag', 'answer', 'choice', 'tier0', 'tier1', 'auto'];
export function betterSource(a: TieSource, b: TieSource): TieSource {
  return PRIORITY.indexOf(a) <= PRIORITY.indexOf(b) ? a : b;
}

/** Set by the couple (solid line), as opposed to the automatic rule (dashed). */
export const isUserSet = (s: TieSource) => s !== 'auto';

export function tieLabel(s: TieSource, names: [string, string]): string {
  switch (s) {
    case 'drag':
      return 'You moved it';
    case 'answer':
      return 'Your answer';
    case 'choice':
      return 'Your choice';
    case 'tier0':
      return `Tier A rule (${names[0]})`;
    case 'tier1':
      return `Tier A rule (${names[1]})`;
    case 'auto':
      return 'Rule (auto)';
  }
}

export function tieDetail(s: TieSource, names: [string, string], above: boolean): string {
  const it = above ? 'that pair over this one' : 'this pair over that one';
  switch (s) {
    case 'drag':
      return 'You dragged it there on this list.';
    case 'answer':
      return `You picked ${it} in This or that.`;
    case 'choice':
      return 'You decided it when resolving a conflict.';
    case 'tier0':
    case 'tier1':
      return `${names[s === 'tier0' ? 0 : 1]}’s Tier A programs come first.`;
    case 'auto':
      return above
        ? 'Neither of you likes this pair more, and it isn’t closer together.'
        : 'Neither of you likes that pair more, and it isn’t closer together.';
  }
}

/** One side's bracket: the row it joins, why, and whether the row has crossed it. */
export interface Hold {
  id: string;
  source: TieSource;
  /** The row is on the wrong side of it (a drop here would clash). */
  crossed: boolean;
}

export interface Holds {
  above: Hold | null;
  below: Hold | null;
}

/** The ties by row, for repeated lookups while dragging. */
export interface TieIndex {
  above: (id: string) => Map<string, TieSource>;
  below: (id: string) => Map<string, TieSource>;
}

export function indexTies(ties: ListTies): TieIndex {
  const up = new Map<string, Map<string, TieSource>>();
  const down = new Map<string, Map<string, TieSource>>();
  const put = (m: Map<string, Map<string, TieSource>>, a: string, b: string, s: TieSource) => {
    let inner = m.get(a);
    if (!inner) m.set(a, (inner = new Map()));
    const cur = inner.get(b);
    inner.set(b, cur ? betterSource(cur, s) : s);
  };
  for (const l of ties.links) {
    put(up, l.lower, l.higher, l.source);
    put(down, l.higher, l.lower, l.source);
  }
  const topOf = new Map<string, number[]>();
  const bottomOf = new Map<string, number[]>();
  ties.groups.forEach((g, i) => {
    for (const id of g.tops) topOf.set(id, [...(topOf.get(id) ?? []), i]);
    for (const id of g.bottoms) bottomOf.set(id, [...(bottomOf.get(id) ?? []), i]);
  });
  const merged = (direct: Map<string, Map<string, TieSource>>, member: Map<string, number[]>, other: 'tops' | 'bottoms') => (id: string) => {
    const out = new Map(direct.get(id) ?? []);
    for (const gi of member.get(id) ?? []) {
      const g = ties.groups[gi];
      for (const x of g[other]) if (x !== id) out.set(x, out.has(x) ? betterSource(out.get(x)!, g.source) : g.source);
    }
    return out;
  };
  return { above: merged(up, bottomOf, 'tops'), below: merged(down, topOf, 'bottoms') };
}

/**
 * The brackets for row `id` in `order`. Per side: a tie the row has crossed (nearest first),
 * else the nearest one set by the couple, else the nearest automatic one.
 */
export function holdsFor(index: TieIndex, order: string[], id: string): Holds {
  const pos = new Map(order.map((x, i) => [x, i]));
  const at = pos.get(id);
  if (at === undefined) return { above: null, below: null };
  const pick = (ties: Map<string, TieSource>, side: 'above' | 'below'): Hold | null => {
    let crossed: [string, TieSource, number] | null = null;
    let user: [string, TieSource, number] | null = null;
    let auto: [string, TieSource, number] | null = null;
    for (const [x, s] of ties) {
      const p = pos.get(x);
      if (p === undefined) continue;
      const dist = side === 'above' ? at - p : p - at; // > 0: on the right side
      if (dist < 0) {
        if (!crossed || -dist < crossed[2]) crossed = [x, s, -dist];
      } else if (isUserSet(s)) {
        if (!user || dist < user[2]) user = [x, s, dist];
      } else if (!auto || dist < auto[2]) auto = [x, s, dist];
    }
    const best = crossed ?? user ?? auto;
    return best ? { id: best[0], source: best[1], crossed: !!crossed } : null;
  };
  return { above: pick(index.above(id), 'above'), below: pick(index.below(id), 'below') };
}
