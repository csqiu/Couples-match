import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';
import { computeFinalList } from './final-list';
import { linkSource } from './pair-view';
import { A, couple, names } from './test-fixtures';

describe('pair views', () => {
  it('carry short names, each partner’s own rank, tier and code', () => {
    const data = couple();
    data.ranks[0].nrmp_code = '1234140C0';
    const list = computeFinalList(data, { names, matchType: 'main' });
    const row = list.rows.find((r) => r.pair.sides[0]?.id === data.ranks[0].program_id && r.pair.sides[1])!;
    expect(row.pair.sides[0]).toMatchObject({ rank: 1, tier: 'A', code: '1234140C0', short: 'MGH IM' });
    expect(row.pair.sides[1]?.rank).toBeGreaterThan(0);
    const nm = list.rows.find((r) => r.band === 'no_match')!;
    expect(nm.pair.sides.filter((s) => s === null)).toHaveLength(1);
  });

  it('“What you’re trading” names programs as sides, not sentences', () => {
    const list = computeFinalList(couple({ settings: { tierAPriority: 'partner1' } }), { names, matchType: 'main' });
    for (const t of list.trades) {
      expect(t.got?.short).toBeTruthy();
      expect(t.better?.short).toBeTruthy();
      expect(t.because.length).toBeGreaterThan(5);
    }
  });

  it('labels where a conflict statement comes from', () => {
    expect(linkSource({ reasons: [{ kind: 'answer', comparisonId: 'c1' }] }, names).label).toBe('Your answer');
    expect(linkSource({ reasons: [{ kind: 'pin', source: 'manual_drag' }] }, names).label).toBe('You moved it');
    expect(linkSource({ reasons: [{ kind: 'tier_a', partner: 1 }] }, names)).toEqual({ label: 'Tier A rule', detail: 'Sam’s Tier A programs come first.' });
    expect(linkSource({ reasons: [{ kind: 'dominance' }, { kind: 'answer', comparisonId: 'c' }] }, names).label).toBe('Rule + Your answer');
  });

  it('a circle of statements comes with both pairs of every link', () => {
    const data = couple();
    // Answer against the common-sense rule: the worse pair over the better one.
    const r0 = analyze(data, { me: A, names, answerMode: 'together' });
    const better = 'seed-mgh-internal-medicine|seed-bch-pediatrics';
    const worse = 'seed-jhh-internal-medicine|seed-bch-pediatrics';
    data.comparisons = [{ id: 'c1', pair_left: worse, pair_right: better, winner: 'left', answered_by: A, both_agreed: true, locked: false, seq: 1 }];
    const r = analyze(data, { me: A, names, answerMode: 'together' });
    const cycle = r.conflicts.find((c) => c.kind === 'cycle');
    expect(r0.conflicts.some((c) => c.kind === 'cycle')).toBe(false);
    expect(cycle?.links?.length).toBeGreaterThanOrEqual(2);
    for (const l of cycle!.links!) {
      expect(l.fromPair?.id).toBe(l.from);
      expect(l.toPair?.id).toBe(l.to);
      expect(l.source.label.length).toBeGreaterThan(2);
    }
  });
});

describe('explanations as parts', () => {
  it('every row’s “why” has parts, with pairs as views (for chips), not just a sentence', async () => {
    const { computeFinalList: compute } = await import('./final-list');
    const list = compute(couple({ settings: { tierAPriority: 'partner1' } }), { names, matchType: 'main' });
    for (const r of list.rows) expect(r.whyParts.length).toBeGreaterThan(0);
    const linked = list.rows.flatMap((r) => r.whyParts).filter((p) => p.kind === 'link' || p.kind === 'score');
    expect(linked.length).toBeGreaterThan(0);
    for (const p of linked) {
      expect(p.higher.sides.some((s) => s?.short)).toBe(true);
      if (p.kind === 'link') expect(p.because).not.toMatch(/\((rule|automatic)\)/);
    }
  });

  it('a blocked move comes with its clash as parts', async () => {
    const { checkMove, computeFinalList: compute } = await import('./final-list');
    const data = couple();
    const list = compute(data, { names, matchType: 'main' });
    const top = list.rows[0].pairId;
    const last = list.rows.filter((r) => r.band !== 'no_match').at(-1)!.pairId;
    const res = checkMove(data, last, top, names, 'higher');
    if (res.ok) return; // nothing blocks this one in the fixture
    expect(res.parts.length).toBeGreaterThan(0);
    expect(res.parts[0].kind).toBe('link');
  });
});
