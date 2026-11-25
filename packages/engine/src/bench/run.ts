/**
 * Learning benchmark: simulated couples answer 40 questions with 10% noise.
 *
 *   pnpm --filter @pairwise/engine bench [--couples 12] [--questions 40] [--noise 0.1]
 *     [--truth even|uneven] [--model per-program|shared]
 *
 * --truth uneven: each couple's true program values are unevenly spaced within tiers.
 * --model per-program: the engine also learns a value per program (off in the app).
 */
import { hiddenParams, simulateCouple, simulatedInput, simulatedLayout } from './simulate';

const args = process.argv.slice(2);
const flag = (name: string, dflt: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const couples = flag('couples', 12);
const questions = flag('questions', 40);
const noise = flag('noise', 0.1);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const unevenTruth = opt('truth', 'even') === 'uneven';
const perProgram = opt('model', 'shared') === 'per-program';
console.log(`truth: ${unevenTruth ? 'uneven' : 'even'} spacing · model: ${perProgram ? 'per-program values' : 'shared parameters only'}\n`);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rows: Array<{ seed: number; before: number; active: number; random: number; relBefore: number; relActive: number; relRandom: number }> = [];
const curves: { active: number[][]; random: number[][] } = { active: [], random: [] };
const t0 = performance.now();

for (let seed = 1; seed <= couples; seed++) {
  const input = simulatedInput(seed);
  const truth = hiddenParams(seed, unevenTruth ? simulatedLayout(input) : undefined);
  const a = simulateCouple(input, truth, { strategy: 'active', questions, noise, perProgram });
  const r = simulateCouple(input, truth, { strategy: 'random', questions, noise, perProgram });
  rows.push({ seed, before: a.tauBefore, active: a.tauAfter, random: r.tauAfter, relBefore: a.relevantBefore, relActive: a.relevantAfter, relRandom: r.relevantAfter });
  curves.active.push(a.tauByQuestion);
  curves.random.push(r.tauByQuestion);
  console.log(
    `couple ${String(seed).padStart(2)}: τ before ${a.tauBefore.toFixed(3)} → active ${a.tauAfter.toFixed(3)}, random ${r.tauAfter.toFixed(3)}`,
  );
}

console.log('\nKendall τ vs. true order over the top 100 pairs (mean of', couples, 'couples)');
console.log(`  before any questions: ${mean(rows.map((r) => r.before)).toFixed(3)}`);
console.log(`  after ${questions} active:      ${mean(rows.map((r) => r.active)).toFixed(3)}  (min ${Math.min(...rows.map((r) => r.active)).toFixed(3)})`);
console.log(`  after ${questions} random:      ${mean(rows.map((r) => r.random)).toFixed(3)}  (min ${Math.min(...rows.map((r) => r.random)).toFixed(3)})`);
console.log('\nSame, counting only orderings that can change where the couple matches (moot ones left out)');
console.log(`  before any questions: ${mean(rows.map((r) => r.relBefore)).toFixed(3)}`);
console.log(`  after ${questions} active:      ${mean(rows.map((r) => r.relActive)).toFixed(3)}  (min ${Math.min(...rows.map((r) => r.relActive)).toFixed(3)})`);
console.log(`  after ${questions} random:      ${mean(rows.map((r) => r.relRandom)).toFixed(3)}  (min ${Math.min(...rows.map((r) => r.relRandom)).toFixed(3)})`);
console.log(`  active beat random on ${rows.filter((r) => r.active > r.random).length}/${couples} couples`);
const at = (s: 'active' | 'random', q: number) => mean(curves[s].map((c) => c[Math.min(q, c.length - 1)]));
console.log('\n  questions:  ' + [0, 5, 10, 20, 30, 40].map((q) => String(q).padStart(6)).join(''));
console.log('  active   :  ' + [0, 5, 10, 20, 30, 40].map((q) => at('active', q).toFixed(3).padStart(6)).join(''));
console.log('  random   :  ' + [0, 5, 10, 20, 30, 40].map((q) => at('random', q).toFixed(3).padStart(6)).join(''));
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)} s)`);
