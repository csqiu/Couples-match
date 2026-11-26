'use client';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { isUserSet, tieDetail, tieLabel, type Hold, type Holds } from '@/lib/list-ties';

/** A bracket shorter than this has no label beside it (the details card says it). */
const LABEL_MIN = 76;
/** Gap from the window edge for a bracket whose row is scrolled out of sight. */
const EDGE = 12;

interface Line {
  side: 'above' | 'below';
  hold: Hold;
  /** Both ends, in the list's own coordinates. */
  from: number;
  to: number;
  /** The far row is scrolled out of sight that way. */
  off: 'up' | 'down' | null;
  /** Where the rows start (the ticks reach to here). */
  rowLeft: number;
}

/**
 * Brackets in the list's left margin from row `focus` to the rows in `holds` (relationship
 * brackets, docs/design-spec.md). Re-measured every frame while shown, so they follow a
 * dragged row and the rows it hops over. Drawn over the list; only the pills take clicks.
 */
export function Brackets({
  container,
  focus,
  holds,
  rankOf,
  names,
}: {
  container: RefObject<HTMLElement | null>;
  focus: string | null;
  holds: Holds;
  /** Where a row is shown right now (1-based), dragged order included. */
  rankOf: (id: string) => number;
  names: [string, string];
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const last = useRef('');

  useEffect(() => {
    if (!focus || (!holds.above && !holds.below)) {
      setLines([]);
      last.current = '';
      return;
    }
    let frame = 0;
    const find = (id: string) => container.current?.querySelector<HTMLElement>(`[data-pair-id="${CSS.escape(id)}"]`) ?? null;
    const measure = () => {
      frame = requestAnimationFrame(measure);
      const box = container.current?.getBoundingClientRect();
      const self = find(focus)?.getBoundingClientRect();
      if (!box || !self) return;
      const mid = (r: DOMRect) => r.top + r.height / 2 - box.top;
      const top = EDGE - box.top;
      const bottom = window.innerHeight - EDGE - box.top;
      const next: Line[] = [];
      for (const side of ['above', 'below'] as const) {
        const hold = holds[side];
        if (!hold) continue;
        const r = find(hold.id)?.getBoundingClientRect();
        if (!r) continue;
        let to = mid(r);
        let off: Line['off'] = null;
        if (to < top) [to, off] = [top + 12, 'up'];
        else if (to > bottom) [to, off] = [bottom - 12, 'down'];
        // The two brackets meet the row a little apart, so they read as two.
        const from = mid(self) + (side === 'above' ? -6 : 6) * (hold.crossed ? -1 : 1);
        next.push({ side, hold, from, to, off, rowLeft: self.left - box.left });
      }
      const key = JSON.stringify(next);
      if (key !== last.current) {
        last.current = key;
        setLines(next);
      }
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [container, focus, holds]);

  if (!focus || !lines.length) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {lines.map((l) => (
        <Bracket key={l.side} line={l} label={tieLabel(l.hold.source, names)} rank={rankOf(l.hold.id)} rows={Math.abs(rankOf(l.hold.id) - rankOf(focus))} container={container} />
      ))}
    </div>
  );
}

function Bracket({ line, label, rank, rows, container }: { line: Line; label: string; rank: number; rows: number; container: RefObject<HTMLElement | null> }) {
  const { hold, from, to, off, rowLeft } = line;
  const tone = hold.crossed ? 'border-warn' : isUserSet(hold.source) ? 'border-action' : 'border-muted';
  const style = hold.crossed || isUserSet(hold.source) ? 'border-solid' : 'border-dashed';
  const top = Math.min(from, to);
  const height = Math.abs(to - from);
  const x = 'left-[3px] sm:left-[5px]';
  const tick = (y: number, hide = false) =>
    hide ? null : <div className={cn('absolute border-t-[1.5px] sm:border-t-2', tone, style, x)} style={{ top: y - 1, width: `calc(${rowLeft}px - 4px)` }} />;
  const text = hold.crossed ? `Crossing · ${label}` : label;
  const pill = cn(
    'absolute left-0 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] leading-4 font-semibold shadow-glass',
    hold.crossed ? 'border-warn bg-warn text-surface' : isUserSet(hold.source) ? 'border-action bg-action text-action-fg' : 'border-border bg-surface-2 text-muted',
  );
  return (
    <>
      <div className={cn('absolute border-l-[1.5px] sm:border-l-2', tone, style, x)} style={{ top, height }} />
      {tick(from)}
      {tick(to, !!off)}
      {off ? (
        <button
          type="button"
          className={cn(pill, 'pointer-events-auto flex items-center gap-1 hover:opacity-90')}
          style={{ top: to }}
          // Keep the open details card open (it closes on any press outside it).
          data-keep-details
          onClick={() => {
            const row = container.current?.querySelector<HTMLElement>(`[data-pair-id="${CSS.escape(hold.id)}"]`);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          aria-label={`Go to rank ${rank}: ${label}`}
        >
          {off === 'up' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}#{rank} · {rows} rows {off === 'up' ? 'up' : 'down'} · {text}
        </button>
      ) : height >= LABEL_MIN || hold.crossed ? (
        <span className={pill} style={{ top: top + height / 2 }}>
          {text}
        </span>
      ) : null}
    </>
  );
}

/** The same brackets in words, for the details card (and screen readers). */
export function HoldsText({ holds, rankOf, labelOf, names }: { holds: Holds; rankOf: (id: string) => number; labelOf: (id: string) => string; names: [string, string] }) {
  const items = (['above', 'below'] as const).flatMap((side) => {
    const h = holds[side];
    return h ? [{ side, h }] : [];
  });
  if (!items.length) {
    return <p className="text-xs text-muted">Nothing you set holds this row in place: it sits here because it fits your answers best.</p>;
  }
  return (
    <div className="flex flex-col gap-2" data-testid="holds">
      <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">What holds it here</p>
      {items.map(({ side, h }) => (
        <div key={side} className="flex items-start gap-2.5 text-[13px]">
          <span
            aria-hidden
            className={cn(
              'mt-1 h-8 w-0 shrink-0 border-l-[3px]',
              h.crossed ? 'border-warn' : isUserSet(h.source) ? 'border-action' : 'border-dashed border-muted',
            )}
          />
          <span>
            <span className={cn('font-semibold', h.crossed && 'text-warn')}>
              {side === 'above' ? 'Above' : 'Below'}: #{rankOf(h.id)} {labelOf(h.id)}
            </span>
            <span className="block text-muted">
              {tieLabel(h.source, names)}
              {h.crossed ? ' — this row is on the wrong side of it.' : ` — ${tieDetail(h.source, names, side === 'above')}`}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
