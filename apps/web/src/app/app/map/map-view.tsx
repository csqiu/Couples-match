'use client';
import type { CoupleData } from '@pairwise/db';
import { BAND_LABEL, type MatchType } from '@pairwise/engine';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BAND_ICON, BandBadge } from '@/components/proximity';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { listMap, MAP_BANDS, type MapBand } from '@/lib/list-map';
import { useFinalList } from '@/lib/use-analysis';
import { BAND_LINE } from './pair-map';

const PairMap = dynamic(() => import('./pair-map').then((m) => m.PairMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-surface-2" />,
});

const TOP_CHOICES = [10, 25, 50, 100, 300];

export function MapView({ data, names, matchType, listLength }: { data: CoupleData; names: [string, string]; matchType: MatchType; listLength: number }) {
  const opts = useMemo(() => ({ names, matchType }), [names, matchType]);
  const { result } = useFinalList(data, opts);
  const [top, setTop] = useState(25);
  const [hidden, setHidden] = useState<Set<MapBand>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);

  const rows = useMemo(() => result?.rows.slice(0, Math.min(listLength, result.length)) ?? [], [result, listLength]);
  const shown = Math.min(top, rows.length);
  const map = useMemo(() => listMap(rows, data.programs, shown), [rows, data.programs, shown]);
  const visible = useMemo(() => map.lines.filter((l) => !hidden.has(l.band)), [map, hidden]);
  const byRank = useMemo(() => new Map(rows.map((r) => [r.rank, r])), [rows]);

  if (!result) return <div className="h-96 animate-pulse rounded-2xl bg-surface-2" aria-label="Loading" />;
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="font-medium">Nothing to map yet</p>
        <p className="max-w-md text-sm text-muted">The map shows your final list. It appears once you’ve both added and ranked programs.</p>
        <Link href="/app/programs" className={buttonVariants({ variant: 'secondary' })}>Choose programs</Link>
      </div>
    );
  }

  const toggle = (b: MapBand) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  const selectedRow = selected != null ? byRank.get(selected) : null;
  const skipped = map.notShown.noMatch + map.notShown.noLocation;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Map of your list</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Each line joins the two programs in one pair. Filled dots are {names[0]}’s programs, rings are {names[1]}’s. Pick a pair to see it.
          </p>
        </div>
        <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Back to the list</Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Show the top
          <Select value={shown} onChange={(e) => setTop(Number(e.target.value))} className="w-28" aria-label="How many pairs to show">
            {TOP_CHOICES.filter((n) => n < rows.length).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value={rows.length}>all {rows.length}</option>
          </Select>
          pairs
        </label>
        <fieldset className="flex flex-wrap gap-2" aria-label="Show distance bands">
          {MAP_BANDS.map((b) => {
            const Icon = BAND_ICON[b];
            const on = !hidden.has(b);
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(b)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
                  on ? 'border-border bg-surface' : 'border-dashed border-border bg-transparent text-muted line-through',
                )}
              >
                <LineSwatch band={b} />
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {BAND_LABEL[b]} ({map.counts[b]})
              </button>
            );
          })}
        </fieldset>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden p-0 sm:p-0">
          <PairMap
            lines={visible}
            selected={selected}
            onSelect={setSelected}
            className="h-[360px] w-full lg:h-[560px]"
            label={`Map of ${visible.length} pairs from your list`}
          />
          {selectedRow ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm" aria-live="polite">
              <span className="min-w-0">
                <strong>#{selectedRow.rank}</strong> {selectedRow.sides[0].name} + {selectedRow.sides[1].name}
              </span>
              <BandBadge band={selectedRow.band} bandLabel={selectedRow.bandLabel} distanceMi={selectedRow.distanceMi} />
            </div>
          ) : null}
          {skipped ? (
            <p className="border-t border-border px-4 py-2 text-xs text-muted">
              Not on the map: {map.notShown.noMatch ? `${map.notShown.noMatch} No Match pair${map.notShown.noMatch === 1 ? '' : 's'}` : ''}
              {map.notShown.noMatch > 0 && map.notShown.noLocation > 0 ? ', ' : ''}
              {map.notShown.noLocation ? `${map.notShown.noLocation} pair${map.notShown.noLocation === 1 ? '' : 's'} with a program we can’t place` : ''}.
            </p>
          ) : null}
        </Card>

        <Card className="p-0 sm:p-0">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Pairs on the map ({visible.length})</h2>
          <ol className="max-h-[560px] divide-y divide-border overflow-y-auto" aria-label="Pairs on the map">
            {visible.map((l) => {
              const row = byRank.get(l.rank)!;
              return (
                <li key={l.pairId}>
                  <button
                    type="button"
                    onClick={() => setSelected(l.rank === selected ? null : l.rank)}
                    aria-pressed={l.rank === selected}
                    className={cn('flex w-full flex-col gap-1 px-4 py-2.5 text-left text-sm hover:bg-surface-2', l.rank === selected && 'bg-accent-soft')}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="w-8 shrink-0 tabular-nums text-muted">#{l.rank}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{row.sides[0].name}</span>
                        <span className="block truncate text-muted">{row.sides[1].name}</span>
                      </span>
                    </span>
                    <span className="pl-10">
                      <BandBadge band={row.band} bandLabel={row.bandLabel} distanceMi={row.distanceMi} />
                    </span>
                  </button>
                </li>
              );
            })}
            {!visible.length ? <li className="px-4 py-6 text-center text-sm text-muted">No pairs in the bands you picked.</li> : null}
          </ol>
        </Card>
      </div>
    </div>
  );
}

/** A tiny sample of the band's line (color and dash) for the legend. */
function LineSwatch({ band }: { band: MapBand }) {
  const s = BAND_LINE[band];
  return (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line
        x1="2"
        y1="4"
        x2="20"
        y2="4"
        stroke={`var(--band-${band})`}
        strokeWidth={Math.min(s.width, 3.5)}
        strokeLinecap="round"
        strokeDasharray={s.dash ? s.dash.map((d) => d * Math.min(s.width, 3.5)).join(' ') : undefined}
      />
    </svg>
  );
}
