'use client';
import { matchOutcome, NO_MATCH, type ProgramRef } from '@pairwise/engine';
import { FlaskConical, X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { ListRow, ProgramOption } from '@/lib/final-list';

/**
 * "What if": the couple ticks the programs each of them could get into (F₁ and F₂).
 * The Match gives them the first row where both sides are within reach.
 */
export interface Scenario {
  reach: [Set<string>, Set<string>];
  /** Programs on both lists with room for both partners at once. */
  both: Set<string>;
}

export type RowReach = 'match' | 'in' | 'out';

export function allReachable(programs: [ProgramOption[], ProgramOption[]]): Scenario {
  const ids = programs.map((ps) => new Set(ps.map((p) => p.id))) as [Set<string>, Set<string>];
  return { reach: ids, both: new Set([...ids[0]].filter((id) => ids[1].has(id))) };
}

/** Where the couple matches under a scenario, and which rows are within reach. */
export function simulate(rows: ListRow[], scenario: Scenario) {
  const sides = rows.map((r) => [r.sides[0].id, r.sides[1].id] as [ProgramRef, ProgramRef]);
  const index = matchOutcome(sides, { partners: scenario.reach, both: scenario.both });
  const ok = (k: 0 | 1, id: string) => id === NO_MATCH || scenario.reach[k].has(id);
  const reach: RowReach[] = sides.map(([a, b], i) =>
    i === index ? 'match' : ok(0, a) && ok(1, b) && (a !== b || a === NO_MATCH || scenario.both.has(a)) ? 'in' : 'out',
  );
  return { index, reach };
}

export function SimulatorPanel({
  programs,
  names,
  rows,
  scenario,
  onChange,
  onClose,
}: {
  programs: [ProgramOption[], ProgramOption[]];
  names: [string, string];
  rows: ListRow[];
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  onClose: () => void;
}) {
  const { index } = useMemo(() => simulate(rows, scenario), [rows, scenario]);
  const shared = programs[0].filter((p) => programs[1].some((q) => q.id === p.id));
  const alone = ([0, 1] as const).map((k) => programs[k].find((p) => scenario.reach[k].has(p.id)) ?? null);
  const row = index >= 0 ? rows[index] : null;

  const toggle = (k: 0 | 1, id: string) => {
    const reach = [new Set(scenario.reach[0]), new Set(scenario.reach[1])] as Scenario['reach'];
    if (reach[k].has(id)) reach[k].delete(id);
    else reach[k].add(id);
    onChange({ ...scenario, reach });
  };
  const setAll = (k: 0 | 1, on: boolean) => {
    const reach = [new Set(scenario.reach[0]), new Set(scenario.reach[1])] as Scenario['reach'];
    reach[k] = on ? new Set(programs[k].map((p) => p.id)) : new Set();
    onChange({ ...scenario, reach });
  };
  const toggleBoth = (id: string) => {
    const both = new Set(scenario.both);
    if (both.has(id)) both.delete(id);
    else both.add(id);
    onChange({ ...scenario, both });
  };

  return (
    <Card className="p-4 sm:p-4" data-testid="simulator">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <FlaskConical className="h-4 w-4 text-accent" aria-hidden /> Try an outcome
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted">
            Tick the programs each of you could get into. The Match gives you the first row where both of you are within
            reach; rows out of reach are dimmed.
          </p>
        </div>
        <button onClick={onClose} className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text" aria-label="Close the outcome simulator">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div role="status" aria-live="polite" className={cn('mt-3 rounded-xl px-3 py-2 text-sm', row ? 'bg-accent-soft' : 'bg-warn-soft text-warn')} data-testid="sim-outcome">
        {row ? (
          <>
            <span className="font-semibold">You match at #{row.rank}:</span> {names[0]} at {row.sides[0].name}, {names[1]} at {row.sides[1].name}
            {row.band !== 'no_match' ? ` (${row.bandLabel.toLowerCase()})` : ''}.
          </>
        ) : (
          <span className="font-semibold">Neither of you matches: no row on the list has both sides within reach.</span>
        )}
        <span className="mt-1 block text-xs text-muted">
          Applying separately, {names[0]} would get {alone[0]?.name ?? 'nothing'} and {names[1]} {alone[1]?.name ?? 'nothing'}.
        </span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {([0, 1] as const).map((k) => (
          <fieldset key={k} className="min-w-0">
            <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-medium">
              <span>{names[k]} could get into</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setAll(k, true)}>All</Button>
                <Button size="sm" variant="ghost" onClick={() => setAll(k, false)}>None</Button>
              </span>
            </legend>
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
              {programs[k].map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-surface-2">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={scenario.reach[k].has(p.id)} onChange={() => toggle(k, p.id)} />
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{p.rank}</span>
                    <span className="min-w-0 truncate" title={`${p.name}${p.place ? ` · ${p.place}` : ''}`}>{p.short}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>

      {shared.length ? (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Room for both of you at once</legend>
          <p className="text-xs text-muted">On both your lists. A row with both of you there needs two open positions.</p>
          <ul className="mt-1 flex flex-wrap gap-x-4">
            {shared.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={scenario.both.has(p.id)} onChange={() => toggleBoth(p.id)} />
                  {p.short}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </Card>
  );
}
