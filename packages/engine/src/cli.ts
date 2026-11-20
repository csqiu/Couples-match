/**
 * Prints a ranked couples list from a JSON fixture.
 *
 *   pnpm --filter @pairwise/engine cli fixtures/sample.json [--top 40] [--why 1,5]
 */
import { readFileSync } from 'node:fs';
import { withDefaults } from './defaults';
import { BAND_LABEL } from './geo';
import { edgeCount, learningStatus, nextQuestions, runEngine } from './index';
import { explainOrder, inversionReport } from './rank';
import { feeEstimate } from './fees';
import { describeConflict, describeExplanation, pairLabel, programLabel, type TextContext } from './text';
import type { EngineInput } from './types';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: cli <fixture.json> [--top N] [--why A,B]');
  process.exit(1);
}
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const raw = JSON.parse(readFileSync(file, 'utf8'));
const input: EngineInput = {
  pins: [],
  exclusions: [],
  exceptions: [],
  comparisons: [],
  seed: 1,
  ...raw,
  settings: withDefaults(raw.settings),
};
const ctx: TextContext = { programs: input.programs, partnerNames: raw.partnerNames };
const [n1, n2] = ctx.partnerNames ?? ['Partner 1', 'Partner 2'];

const t0 = performance.now();
const { pairs, graph, conflicts, list, posterior } = runEngine(input);
const ms = performance.now() - t0;

const top = Number(flag('top') ?? 30);
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));

console.log(`\n${pairs.length} candidate pairs, ${edgeCount(graph)} constraints (${graph.reasons.size} stored edges), built in ${ms.toFixed(1)} ms\n`);
console.log(`${'#'.padStart(4)}  ${pad(n1, 34)} ${pad(n2, 34)} ${'miles'.padStart(6)}  band`);
console.log('-'.repeat(96));
for (const row of list.rows.slice(0, top)) {
  const [a, b] = row.pair.programs;
  const mi = row.pair.distanceMi == null ? '' : Math.round(row.pair.distanceMi).toString();
  console.log(
    `${String(row.rank).padStart(4)}  ${pad(programLabel(ctx, a), 34)} ${pad(programLabel(ctx, b), 34)} ${mi.padStart(6)}  ${BAND_LABEL[row.pair.band]}`,
  );
}
if (list.rows.length > top) console.log(`   … ${list.rows.length - top} more rows (use --top)`);

console.log(`\nConflicts (${conflicts.length}):`);
for (const c of conflicts) console.log(` • [${c.kind}] ${describeConflict(ctx, c)}`);

const fees = feeEstimate(list.rows.map((r) => r.pair));
console.log(
  `\nFee estimate (${fees.ranks} ranks): ${n1} $${fees.partners[0].totalUsd} (${fees.partners[0].uniqueCodes} unique codes), ` +
    `${n2} $${fees.partners[1].totalUsd} (${fees.partners[1].uniqueCodes} unique codes)`,
);
if (fees.tierWarning) {
  console.log(`  Tip: cutting ${fees.tierWarning.pairsToCut} pair(s) saves $${fees.tierWarning.saveUsdPerPartner} per partner.`);
}

const inv = inversionReport(list, 3);
if (inv.length) {
  console.log('\nWhat you are trading (first few):');
  for (const i of inv) {
    console.log(
      ` • ${i.partner === 0 ? n1 : n2} gets ${programLabel(ctx, list.rows[i.rank - 1].pair.programs[i.partner])} at #${i.rank} before ${programLabel(ctx, i.betterProgram)} (#${i.betterProgramFirstRank}) — ${i.because.join(', ') || 'constraint'}`,
    );
  }
}

const status = learningStatus(list, posterior, input.comparisons);
console.log(
  `\nList confidence: ${Math.round(status.confidence * 100)}% after ${status.answered} answer(s)${status.done ? ' — good enough to stop' : ''}`,
);
console.log('Next questions:');
for (const q of nextQuestions(list, posterior, 3, { comparisons: input.comparisons })) {
  console.log(
    ` • [${q.kind}${q.tradeoff ? ', trade-off' : ''}] ${pairLabel(ctx, q.left)}  vs.  ${pairLabel(ctx, q.right)}  (model expects left ${Math.round(q.pLeft * 100)}%)`,
  );
}

const why = flag('why');
if (why) {
  const [x, y] = why.split(',').map((s) => list.rows[Number(s) - 1]?.pair.id);
  if (x && y) console.log(`\nWhy #${why.replace(',', ' vs #')}? ${describeExplanation(ctx, explainOrder(list, x, y))}`);
}
console.log('');
