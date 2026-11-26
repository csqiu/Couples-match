import { describe, expect, it } from 'vitest';
import { computeFinalList } from './final-list';
import { holdsFor, indexTies, type ListTies } from './list-ties';
import { couple, names } from './test-fixtures';

const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const ties: ListTies = {
  links: [
    { higher: 'b', lower: 'e', source: 'answer' },
    { higher: 'd', lower: 'e', source: 'auto' },
    { higher: 'e', lower: 'g', source: 'auto' },
  ],
  groups: [{ source: 'tier0', tops: ['a', 'b'], bottoms: ['f', 'g'] }],
};

describe('relationship brackets', () => {
  const index = indexTies(ties);

  it('joins a row to the nearest tie the couple set, else the nearest automatic one', () => {
    // Above e: the answer from b wins over the nearer automatic rule from d.
    expect(holdsFor(index, order, 'e')).toEqual({
      above: { id: 'b', source: 'answer', crossed: false },
      below: { id: 'g', source: 'auto', crossed: false },
    });
    // f sits below both Tier A pairs: the nearer one, b.
    expect(holdsFor(index, order, 'f')).toEqual({ above: { id: 'b', source: 'tier0', crossed: false }, below: null });
    expect(holdsFor(index, order, 'c')).toEqual({ above: null, below: null });
  });

  it('a dragged row that passes a tie shows that tie as crossed', () => {
    // e dragged up between a and b: it has passed b (and d).
    const dragged = ['a', 'e', 'b', 'c', 'd', 'f', 'g'];
    expect(holdsFor(index, dragged, 'e').above).toEqual({ id: 'b', source: 'answer', crossed: true });
    // b dragged below f: its Tier A rule over f is crossed.
    expect(holdsFor(index, ['a', 'c', 'd', 'e', 'f', 'b', 'g'], 'b').below).toEqual({ id: 'f', source: 'tier0', crossed: true });
  });

  it('the final list carries ties for its rows: drags, automatic rules, never locked No Match rows', () => {
    const data = couple();
    const first = computeFinalList(data, { names, matchType: 'main' });
    const [x, y] = [first.rows[3].pairId, first.rows[1].pairId];
    data.pins = [{ id: 'p1', higher_pair: x, lower_pair: y, source: 'manual_drag', comparison_id: null, moved_pair: 'higher' }];
    const list = computeFinalList(data, { names, matchType: 'main' });
    expect(list.ties.links).toContainEqual({ higher: x, lower: y, source: 'drag' });
    expect(list.ties.links.some((l) => l.source === 'auto')).toBe(true);
    const locked = new Set(list.rows.filter((r) => r.locked).map((r) => r.pairId));
    expect(locked.size).toBeGreaterThan(0);
    expect(list.ties.links.some((l) => locked.has(l.higher) || locked.has(l.lower))).toBe(false);
    const h = holdsFor(indexTies(list.ties), list.rows.map((r) => r.pairId), x);
    expect(h.below).toEqual({ id: y, source: 'drag', crossed: false });
  });
});
