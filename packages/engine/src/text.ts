/**
 * Plain-language rendering of reasons and conflicts, e.g.
 * "You said A over B (comparison #7). B is over C because both of you prefer it
 * at the same distance (automatic). C is over A because of Partner 1's Tier A rule (rule)."
 */
import { splitPairId } from './candidates.js';
import { BAND_LABEL } from './geo.js';
import type { Conflict } from './conflicts.js';
import type { Reason } from './rank.js';
import { NO_MATCH, type EdgeReason, type Link, type PairId, type ProgramInfo } from './types.js';

export interface TextContext {
  programs: Record<string, ProgramInfo>;
  partnerNames?: [string, string];
}

function names(ctx: TextContext): [string, string] {
  return ctx.partnerNames ?? ['Partner 1', 'Partner 2'];
}

export function programLabel(ctx: TextContext, id: string): string {
  return id === NO_MATCH ? 'No Match' : (ctx.programs[id]?.name ?? id);
}

export function pairLabel(ctx: TextContext, id: PairId): string {
  const [a, b] = splitPairId(id);
  return `${programLabel(ctx, a)} + ${programLabel(ctx, b)}`;
}

export function describeReason(ctx: TextContext, r: EdgeReason): string {
  const [n1, n2] = names(ctx);
  switch (r.kind) {
    case 'dominance':
      return 'both of you like it at least as much and it is no farther apart (automatic)';
    case 'tier_a':
      return `of ${r.partner === 0 ? n1 : n2}'s Tier A rule (rule)`;
    case 'no_match_bottom':
      return 'pairs where you both match go above No Match pairs (rule)';
    case 'pin':
      if (r.source === 'comparison') return `you said so${r.comparisonId ? ` (comparison ${r.comparisonId})` : ''}`;
      if (r.source === 'manual_drag') return 'you dragged it there';
      return 'you decided this when resolving a conflict';
  }
}

export function describeLink(ctx: TextContext, link: Link): string {
  const a = pairLabel(ctx, link.from);
  const b = pairLabel(ctx, link.to);
  const pin = link.reasons.find((r) => r.kind === 'pin');
  if (pin && pin.kind === 'pin' && pin.source === 'comparison') {
    return `You said ${a} over ${b}${pin.comparisonId ? ` (comparison ${pin.comparisonId})` : ''}.`;
  }
  return `${a} is over ${b} because ${link.reasons.map((r) => describeReason(ctx, r)).join('; and ')}.`;
}

export function describeConflict(ctx: TextContext, c: Conflict): string {
  const [n1, n2] = names(ctx);
  switch (c.kind) {
    case 'cycle':
      return c.links.map((l) => describeLink(ctx, l)).join(' ');
    case 'tier_a_collision':
      return `When only one of you can get a Tier A program, who gets priority? (e.g. ${pairLabel(ctx, c.partner1Example)} vs. ${pairLabel(ctx, c.partner2Example)}) — ${n1}, ${n2}, or decide case by case.`;
    case 'surprising_answer': {
      const won = c.comparison.winner === 'left' ? c.comparison.left : c.comparison.right;
      const lost = c.comparison.winner === 'left' ? c.comparison.right : c.comparison.left;
      return `Still true? You picked ${pairLabel(ctx, won)} over ${pairLabel(ctx, lost)}, but your other answers suggest the opposite.`;
    }
    case 'disagreement':
      return `You answered differently: ${pairLabel(ctx, c.comparisons[0].left)} vs. ${pairLabel(ctx, c.comparisons[0].right)}. Talk it through and pick one together.`;
  }
}

export function describeExplanation(ctx: TextContext, reasons: Reason[]): string {
  return reasons
    .map((r) => {
      switch (r.kind) {
        case 'constraint':
          return r.links.map((l) => describeLink(ctx, l)).join(' ');
        case 'score':
          return `${pairLabel(ctx, r.higher)} fits your answers better than ${pairLabel(ctx, r.lower)} (score ${r.higherScore.mean.toFixed(2)} vs. ${r.lowerScore.mean.toFixed(2)}).`;
        case 'blocked_by':
          return `${r.links.map((l) => describeLink(ctx, l)).join(' ')} ${describeExplanation(ctx, r.then)}`;
      }
    })
    .join(' ');
}

export { BAND_LABEL };
