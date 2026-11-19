/**
 * Builds an example couple from the seed programs and prints their list.
 *
 *   pnpm --filter @pairwise/data demo [specialty1] [specialty2]
 *   pnpm --filter @pairwise/data demo internal-medicine pediatrics
 */
import {
  BAND_LABEL,
  edgeCount,
  learningStatus,
  nextQuestions,
  pairLabel,
  programLabel,
  runEngine,
  withDefaults,
  type EngineInput,
  type RankEntry,
  type Tier,
} from '@pairwise/engine';
import { SEED_PROGRAMS, toEngineProgram } from '../seed.js';

const [s1 = 'internal-medicine', s2 = 'pediatrics'] = process.argv.slice(2);
const pick = (code: string) => SEED_PROGRAMS.filter((p) => p.specialtyCode === code);
const a = pick(s1);
const b = pick(s2);
if (!a.length || !b.length) {
  console.error(`No seed programs for ${!a.length ? s1 : s2}. Try internal-medicine, pediatrics, general-surgery, emergency-medicine, psychiatry.`);
  process.exit(1);
}

// Deterministic, plausible tiers: first two A, next ~half B, rest C (in seed order, shuffled by a fixed rule).
const order = <T extends { id: string }>(xs: T[], salt: number) =>
  [...xs].sort((x, y) => ((hash(x.id) ^ salt) >>> 0) - ((hash(y.id) ^ salt) >>> 0));
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const list = (xs: typeof a, salt: number): RankEntry[] =>
  order(xs, salt).map((p, i, all) => ({
    programId: p.id,
    rank: i + 1,
    tier: (i < 2 ? 'A' : i < Math.ceil(all.length * 0.6) ? 'B' : 'C') as Tier,
    acceptable: true,
  }));

const input: EngineInput = {
  programs: Object.fromEntries([...a, ...b].map((p) => [p.id, toEngineProgram(p)])),
  lists: [list(a, 0x1234), list(b, 0xbeef)],
  settings: withDefaults({ tierAPriority: 'case_by_case' }),
  pins: [],
  exclusions: [],
  exceptions: [],
  comparisons: [],
  seed: 1,
};
const ctx = { programs: input.programs, partnerNames: ['Partner 1', 'Partner 2'] as [string, string] };

const t0 = performance.now();
const { pairs, graph, list: ranked, posterior, conflicts } = runEngine(input);
console.log(
  `\n${a.length} ${s1} × ${b.length} ${s2} programs → ${pairs.length} pairs, ${edgeCount(graph)} constraints, ${(performance.now() - t0).toFixed(0)} ms\n`,
);
for (const [k, l] of input.lists.entries()) {
  console.log(`Partner ${k + 1}: ${l.map((e) => `${e.tier} ${programLabel(ctx, e.programId)}`).join(' · ')}\n`);
}
for (const row of ranked.rows.slice(0, 20)) {
  const mi = row.pair.distanceMi == null ? '' : `${Math.round(row.pair.distanceMi)} mi`;
  console.log(`${String(row.rank).padStart(3)}. ${pairLabel(ctx, row.pair.id)}  —  ${BAND_LABEL[row.pair.band]} ${mi}`);
}
console.log(`  … ${ranked.rows.length - 20} more`);
console.log(`\nConflicts: ${conflicts.length}`);
const status = learningStatus(ranked, posterior);
console.log(`List confidence: ${Math.round(status.confidence * 100)}%. First question:`);
const [q] = nextQuestions(ranked, posterior, 1);
if (q) console.log(`  ${pairLabel(ctx, q.left)}\n    vs.\n  ${pairLabel(ctx, q.right)}\n`);
