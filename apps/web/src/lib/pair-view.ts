/**
 * One display shape for a pair, used by every pair component (components/pair.tsx):
 * large cards, the medium details card, small rows and inline chips. Pure, so it
 * runs in the Web Worker and in unit tests.
 */
import { shortProgramName } from '@pairwise/data';
import { BAND_LABEL, NO_MATCH, normalizeList, type Band, type EngineInput, type Link, type Pair, type ProgramInfo, type Tier } from '@pairwise/engine';

export interface ProgramSide {
  id: string;
  name: string;
  /** Abbreviation for tight spaces ("Hopkins Plastics"). */
  short: string;
  place: string;
  lat: number | null;
  lon: number | null;
  tier: Tier | null;
  /** This partner's own rank for the program (1 = their favorite), or null. */
  rank: number | null;
  /** The NRMP code to type into R3 ('' when not entered yet). */
  code: string;
}

export interface PairView {
  id: string;
  /** [partner A's program, partner B's program]; null side = No Match. */
  sides: [ProgramSide | null, ProgramSide | null];
  distanceMi: number | null;
  band: Band;
  bandLabel: string;
}

/** Builds the display view of a pair (names, places, tiers, ranks, codes, distance). */
export function pairViewer(input: EngineInput): (pair: Pair) => PairView {
  const entries = ([0, 1] as const).map((k) => new Map(normalizeList(input.lists[k]).map((e) => [e.programId, e])));
  const raw = ([0, 1] as const).map((k) => new Map(input.lists[k].map((e) => [e.programId, e])));
  return (pair) => ({
    id: pair.id,
    sides: ([0, 1] as const).map((k) => {
      const ref = pair.programs[k];
      if (ref === NO_MATCH) return null;
      const p = input.programs[ref];
      const e = raw[k].get(ref);
      return {
        id: ref,
        name: p.name,
        // The partner's own short name for it, if they set one (both partners see it).
        short: shortProgramName(p.name, e?.shortName ?? p.shortName),
        place: [p.city, p.state].filter(Boolean).join(', '),
        lat: p.lat,
        lon: p.lon,
        tier: e?.tier ?? null,
        rank: entries[k].get(ref)?.effectiveRank ?? null,
        code: e?.nrmpCode ?? p.nrmpCode ?? '',
      };
    }) as [ProgramSide | null, ProgramSide | null],
    distanceMi: pair.distanceMi,
    band: pair.band,
    bandLabel: BAND_LABEL[pair.band],
  });
}

/** Where a "this pair above that one" statement comes from, for conflict rows. */
export interface LinkSource {
  /** Short label: "Your answer", "Rule", "You moved it"… */
  label: string;
  /** One line of detail. */
  detail: string;
}

export function linkSource(link: Pick<Link, 'reasons'>, names: [string, string]): LinkSource {
  const parts = link.reasons.map((r): LinkSource => {
    switch (r.kind) {
      case 'answer':
        return { label: 'Your answer', detail: 'You chose this in This or that.' };
      case 'pin':
        if (r.source === 'manual_drag') return { label: 'You moved it', detail: 'Dragged on the final list.' };
        if (r.source === 'comparison') return { label: 'Your answer', detail: 'You chose this and locked it in.' };
        return { label: 'Your choice', detail: 'Decided when resolving an earlier conflict.' };
      case 'dominance':
        return { label: 'Rule', detail: 'Both of you like it at least as much, and it’s no farther apart.' };
      case 'tier_a':
        return { label: 'Tier A rule', detail: `${names[r.partner]}’s Tier A programs come first.` };
      case 'no_match_bottom':
        return { label: 'Rule', detail: 'Pairs where you both match go above No Match.' };
    }
  });
  if (parts.length <= 1) return parts[0] ?? { label: 'Rule', detail: '' };
  return { label: [...new Set(parts.map((p) => p.label))].join(' + '), detail: parts.map((p) => p.detail).join(' ') };
}

/**
 * Programs keyed by id with their short names as `name`, for the engine's sentence
 * builders: explanations read "MGH IM + BCH Peds", not two full hospital names. A name a
 * partner set for a program on their list wins (partner A's first, for a shared program).
 */
export function shortNamed(programs: Record<string, ProgramInfo>, lists?: EngineInput['lists']): Record<string, ProgramInfo> {
  const own = new Map<string, string>();
  for (const list of [...(lists ?? [])].reverse()) for (const e of list) if (e.shortName) own.set(e.programId, e.shortName);
  return Object.fromEntries(Object.entries(programs).map(([id, p]) => [id, { ...p, name: shortProgramName(p.name, own.get(id) ?? p.shortName) }]));
}
