/**
 * The theme warm-up, run on the real engine.
 *
 * Fonts play partner 1's program list and color schemes play partner 2's, so the 16
 * looks are the 16 "pairs". Every pair is "together" (looks have no distance), which
 * leaves exactly one trade-off for the model to learn: how much the font matters
 * against the colors. That is the same model the Match list uses to learn how much
 * distance matters against each partner's rank.
 *
 * One difference, on purpose: in the Match, a question between two pairs is moot when a
 * pair that's better for both of you is always available whenever they are, so with no
 * distance the engine has nothing to ask (and says so). Picking a look isn't a match,
 * you can have any of them, so the warm-up asks about the closest neighbours the common
 * sense rule leaves open, most uncertain first.
 */
import {
  buildCandidates,
  buildConstraintGraph,
  fitModel,
  hardClosure,
  mustRankAbove,
  NO_MATCH,
  priorPosterior,
  questionKey,
  rankPairs,
  scorePairs,
  withDefaults,
  type Comparison,
  type EngineInput,
  type RankEntry,
} from '@pairwise/engine';
import { FONTS, PALETTES, type FontId, type Look, type LookId, type PaletteId } from './looks';

export interface WarmupAnswer {
  left: LookId;
  right: LookId;
  winner: 'left' | 'right' | 'tie';
}

export interface WarmupInput {
  fonts: FontId[];
  palettes: PaletteId[];
  answers: WarmupAnswer[];
}

export interface WarmupResult {
  /** All 16 looks, best first. */
  order: Look[];
  /** The next question, or null when the list is settled (or the question cap is reached). */
  question: { left: Look; right: Look } | null;
  /** Share of neighbouring rows whose order is settled (by the rule or 90% sure): "list confidence". */
  confidence: number;
  answered: number;
  /** Neighbouring rows the common-sense rule orders without asking. */
  settledByRule: number;
}

/** A short warm-up: it's a demo, not the Match. */
export const WARMUP_MAX_QUESTIONS = 6;
/** Stop asking when every open neighbour is at least this sure. */
const SURE = 0.9;
const SEED = 2027;

const toPairId = (l: Look) => `${l.font}|${l.palette}`;
const toLookId = (l: Look): LookId => `${l.font}.${l.palette}`;
const fromPairId = (id: string): Look => {
  const [font, palette] = id.split('|');
  return { font: font as FontId, palette: palette as PaletteId };
};
const lookIdToPair = (id: LookId) => id.replace('.', '|');

export function warmupInput(fonts: FontId[], palettes: PaletteId[], answers: WarmupAnswer[]): EngineInput {
  const programs: EngineInput['programs'] = {};
  // One shared place: every look is "together".
  for (const f of FONTS) programs[f.id] = { id: f.id, name: f.name, lat: 40, lon: -75, cbsaCode: 'warmup' };
  for (const p of PALETTES) programs[p.id] = { id: p.id, name: p.name, lat: 40, lon: -75, cbsaCode: 'warmup' };
  const list = (ids: string[]): RankEntry[] => ids.map((programId, i) => ({ programId, rank: i + 1, tier: 'B', acceptable: true }));
  const comparisons: Comparison[] = answers.map((a, i) => ({
    id: `warmup-${i}`,
    left: lookIdToPair(a.left),
    right: lookIdToPair(a.right),
    winner: a.winner,
    seq: i,
  }));
  return {
    programs,
    lists: [list(fonts), list(palettes)],
    settings: withDefaults({ listLength: fonts.length * palettes.length }),
    pins: [],
    exclusions: [],
    exceptions: [],
    comparisons,
    seed: SEED,
  };
}

/** Normal CDF (Abramowitz–Stegun 7.1.26), for "how sure is the model that x beats y". */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function runWarmup({ fonts, palettes, answers }: WarmupInput): WarmupResult {
  const input = warmupInput(fonts, palettes, answers);
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const posterior = fitModel(priorPosterior(input.seed), input.comparisons, { pairs, settings: input.settings, seed: input.seed });
  const scores = scorePairs(pairs, posterior, input.settings);
  const list = rankPairs(graph, scores);
  // No Match rows mean nothing for a look.
  const order = list.order.filter((id) => !id.includes(NO_MATCH));

  const closure = hardClosure(graph);
  const asked = new Set(input.comparisons.map((c) => questionKey(c.left, c.right)));
  let settledByRule = 0;
  let sure = 0;
  let best: { u: string; v: string; uncertainty: number } | null = null;
  for (let i = 0; i + 1 < order.length; i++) {
    const [u, v] = [order[i], order[i + 1]];
    if (mustRankAbove(closure, graph.index.get(u)!, graph.index.get(v)!)) {
      settledByRule++;
      sure++;
      continue;
    }
    const su = scores.get(u)!;
    const sv = scores.get(v)!;
    const p = phi((su.mean - sv.mean) / Math.sqrt(su.sd ** 2 + sv.sd ** 2 + 1e-9));
    if (p >= SURE || asked.has(questionKey(u, v))) {
      sure++;
      continue;
    }
    const uncertainty = 1 - Math.abs(2 * p - 1);
    if (!best || uncertainty > best.uncertainty) best = { u, v, uncertainty };
  }
  const total = Math.max(1, order.length - 1);
  const capped = answers.length >= WARMUP_MAX_QUESTIONS;
  return {
    order: order.map(fromPairId),
    question: best && !capped ? { left: fromPairId(best.u), right: fromPairId(best.v) } : null,
    confidence: sure / total,
    answered: answers.length,
    settledByRule,
  };
}

export { toLookId };
