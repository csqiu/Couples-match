import { describe, expect, it } from 'vitest';
import {
  breakLink,
  buildCandidates,
  buildLayout,
  findConflicts,
  fitModel,
  latentToParams,
  partnerValue,
  posteriorMoments,
  priorPosterior,
  runEngine,
  withDefaults,
  type Comparison,
  type EngineInput,
  type Pair,
} from '../src/index';
import { simulatedInput } from '../src/bench/simulate';
import { rng } from './helpers';

const P = (id: string, lat: number, lon: number, cbsa: string) => ({ id, name: id, lat, lon, cbsaCode: cbsa });
const answers = (xs: Array<[string, string]>): Comparison[] =>
  xs.map(([l, r], i) => ({ id: `c${i}`, left: l, right: r, winner: 'left', seq: i + 1 }));

/** Cecil ranks NYU over UCLA; Arianna ranks UCSD, Cornell, Stanford. All Tier B. */
function couple(comparisons: Comparison[]): EngineInput {
  return {
    programs: {
      nyu: P('nyu', 40.74, -73.97, '35620'),
      ucla: P('ucla', 34.07, -118.44, '31080'),
      cornell: P('cornell', 40.76, -73.95, '35620'),
      ucsd: P('ucsd', 32.88, -117.23, '41740'),
      stanford: P('stanford', 37.43, -122.17, '41940'),
    },
    lists: [
      [{ programId: 'nyu', rank: 1, tier: 'B', acceptable: true }, { programId: 'ucla', rank: 2, tier: 'B', acceptable: true }],
      [
        { programId: 'ucsd', rank: 1, tier: 'B', acceptable: true },
        { programId: 'cornell', rank: 2, tier: 'B', acceptable: true },
        { programId: 'stanford', rank: 3, tier: 'B', acceptable: true },
      ],
    ],
    settings: withDefaults({ tierARule: ['off', 'off'] }),
    pins: [],
    exclusions: [],
    exceptions: [],
    comparisons,
    seed: 7,
  };
}
const above = (input: EngineInput, a: string, b: string) => {
  const { position } = runEngine(input).list;
  return position.get(a)! < position.get(b)!;
};

describe('Every answer holds in the list', () => {
  it('keeps conditional preferences the model alone would overrule', () => {
    // NYU over UCLA if Arianna is at Cornell; UCLA over NYU if she is at UCSD; and she
    // still wants UCSD even with Cecil at NYU. The model alone overrules the last one.
    const xs: Array<[string, string]> = [
      ['nyu|cornell', 'ucla|cornell'],
      ['ucla|ucsd', 'nyu|ucsd'],
      ['nyu|ucsd', 'nyu|cornell'],
    ];
    const input = couple(answers(xs));
    for (const [a, b] of xs) expect(above(input, a, b), `${a} > ${b}`).toBe(true);
    expect(runEngine(input).list.hasCycles).toBe(false);
  });

  it('an answer that contradicts the common-sense rule is a conflict, settled by the couple', () => {
    // "If Arianna is in California, I want California": both pairs are "apart", so the
    // common-sense rule says (NYU, Stanford) first, since Cecil ranks NYU higher.
    const input = couple(answers([['ucla|stanford', 'nyu|stanford']]));
    const { graph, posterior } = runEngine(input);
    const cycles = findConflicts(graph, posterior, input.comparisons).filter((c) => c.kind === 'cycle');
    expect(cycles).toHaveLength(1);
    const rule = cycles[0].kind === 'cycle' ? cycles[0].links.find((l) => l.reasons.some((r) => r.kind === 'dominance'))! : null;
    expect(rule).toBeTruthy();
    const fixed = breakLink(input, rule!);
    expect(runEngine(fixed).list.hasCycles).toBe(false);
    expect(above(fixed, 'ucla|stanford', 'nyu|stanford')).toBe(true);
  });

  it('ties and disagreements are not enforced', () => {
    const tie: Comparison = { id: 't', left: 'ucla|stanford', right: 'nyu|stanford', winner: 'tie', seq: 1 };
    expect(above(couple([tie]), 'ucla|stanford', 'nyu|stanford')).toBe(false);
    const split: Comparison[] = [
      { id: 'a', left: 'ucla|stanford', right: 'nyu|stanford', winner: 'left', answeredBy: 'cecil', seq: 1 },
      { id: 'b', left: 'ucla|stanford', right: 'nyu|stanford', winner: 'right', answeredBy: 'arianna', seq: 2 },
    ];
    expect(above(couple(split), 'ucla|stanford', 'nyu|stanford')).toBe(false);
  });

  it('answers in a circle become a cycle to resolve; breaking one keeps the rest', () => {
    // Three pairs the common-sense rule leaves unordered, answered in a circle.
    const circle: Array<[string, string]> = [['ucla|ucsd', 'nyu|ucsd'], ['nyu|ucsd', 'nyu|cornell'], ['nyu|cornell', 'ucla|ucsd']];
    const input = couple(answers(circle));
    const { graph, posterior } = runEngine(input);
    const cycles = findConflicts(graph, posterior, input.comparisons).filter((c) => c.kind === 'cycle');
    expect(cycles).toHaveLength(1);
    const links = cycles[0].kind === 'cycle' ? cycles[0].links : [];
    expect(links.every((l) => l.reasons.some((r) => r.kind === 'answer'))).toBe(true);
    const broken = links[0];
    const fixed = breakLink(input, broken);
    expect(fixed.exceptions).toEqual([{ higher: broken.from, lower: broken.to }]);
    expect(runEngine(fixed).list.hasCycles).toBe(false);
    for (const l of links.slice(1)) expect(above(fixed, l.from, l.to), `${l.from} > ${l.to}`).toBe(true);
  });
});

describe('Per-program values', () => {
  const input = simulatedInput(4);
  const pairs = buildCandidates(input);
  const layout = buildLayout(pairs);
  const first = (k: 0 | 1, id: string) => pairs.find((p) => p.programs[k] === id && p.programs[1 - k] !== 'NO_MATCH')!;

  it('even spacing at the prior centre', () => {
    const p = latentToParams(new Array(layout.dim).fill(0), layout);
    for (const k of [0, 1] as const) for (const v of Object.values(p.offsets![k])) expect(v).toBeCloseTo(0, 12);
  });

  it("never reorders a partner's list or moves a program out of its tier", () => {
    const r = rng(11);
    for (let trial = 0; trial < 200; trial++) {
      const z = Array.from({ length: layout.dim }, () => (r.next() - 0.5) * 8);
      const params = latentToParams(z, layout);
      for (const k of [0, 1] as const) {
        const values = layout.tiers[k].flat().map((id) => partnerValue(params, first(k, id), k));
        for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
      }
    }
  });

  it('learns an uneven gap from answers', () => {
    // Partner 1 has four Tier B programs in one city; partner 2 has one there and one far away.
    const city = P('city', 40.75, -73.99, '35620');
    const far = P('far', 34.05, -118.24, '31080');
    const two: EngineInput = {
      programs: { a: { ...city, id: 'a' }, b: { ...city, id: 'b' }, c: { ...city, id: 'c' }, d: { ...city, id: 'd' }, x: { ...city, id: 'x' }, y: { ...far, id: 'y' } },
      lists: [
        ['a', 'b', 'c', 'd'].map((id, i) => ({ programId: id, rank: i + 1, tier: 'B' as const, acceptable: true })),
        [{ programId: 'x', rank: 1, tier: 'B', acceptable: true }, { programId: 'y', rank: 2, tier: 'B', acceptable: true }],
      ],
      settings: withDefaults({ tierARule: ['off', 'off'] }),
      pins: [], exclusions: [], exceptions: [], comparisons: [], seed: 3,
    };
    const ps = buildCandidates(two);
    const lay = buildLayout(ps);
    const byId = new Map(ps.map((p) => [p.id, p]));
    // #1 is worth being apart for; #3 over #4 is not.
    const cs = answers([['a|y', 'b|x'], ['a|y', 'c|x'], ['d|x', 'c|y'], ['b|x', 'c|y']]);
    const gap = (post: ReturnType<typeof priorPosterior>, hi: string, lo: string) => {
      const m = posteriorMoments(post);
      const v = (id: string) => partnerValue(
        { base: [{ A: m.mean[0], B: m.mean[1], C: m.mean[2] }, { A: m.mean[4], B: m.mean[5], C: m.mean[6] }], s: [m.mean[3], m.mean[7]], pen: { commutable: 0, drivable: 0, apart: 0 }, vNM: 0, offsets: [Object.fromEntries([...lay.index[0]].map(([k, i]) => [k, m.mean[i]])), {}] },
        byId.get(`${id}|x`) as Pair, 0);
      return v(hi) - v(lo);
    };
    const prior = priorPosterior(3, 2000, lay);
    const post = fitModel(prior, cs, { pairs: ps, settings: two.settings, seed: 3 });
    const before = gap(prior, 'a', 'b') / gap(prior, 'c', 'd');
    const after = gap(post, 'a', 'b') / gap(post, 'c', 'd');
    expect(after).toBeGreaterThan(before * 1.5);
  });
});
