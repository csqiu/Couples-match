'use client';
/**
 * The four ways the app shows a pair (docs/design-spec.md, "Pair display"):
 *  - large  (PairLarge):   This or that, Conflicts, specific comparisons
 *  - medium (PairMedium):  the details card that opens from a small row (hover, focus or tap)
 *  - small  (PairNames, PairTile): final list rows, side panels, conflict statements
 *  - inline (ProgramChip, PairChip): program names inside sentences
 * Same rules everywhere: partner 1 is sage, partner 2 is plum; the short name first and the
 * full name one size up; distance is always the band chip; numbers are mono. Colour is never
 * the only cue: order (partner 1 first / on top) and the names say whose program it is.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/avatar';
import { MiniMap } from '@/components/mini-map';
import { BandBadge } from '@/components/proximity';
import { cn } from '@/lib/cn';
import type { PairView, ProgramSide } from '@/lib/pair-view';

type Slot = 0 | 1;

/** Text colour for a partner's program name (AA on glass and on the partner's soft fill). */
export const PARTNER_TEXT = ['text-accent', 'text-plum-deep'] as const;
const PARTNER_SOFT = ['bg-partner-1-soft', 'bg-partner-2-soft'] as const;
const PARTNER_BAR = ['border-partner-1', 'border-partner-2'] as const;
/** Eyebrows use the deeper partner text colours: 11.5px text needs the extra contrast. */
const PARTNER_EYEBROW = PARTNER_TEXT;

function eyebrow(name: string, side: ProgramSide | null, showTier: boolean) {
  return [name, side?.rank ? `#${side.rank}` : null, side?.tier && showTier ? `Tier ${side.tier}` : null].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// Inline

/** One program inside a sentence, in its partner's colour. */
export function ProgramChip({ side, slot, className }: { side: ProgramSide | null; slot: Slot; className?: string }) {
  if (!side) return <span className={cn('rounded-md px-1.5 py-0.5 font-semibold text-warn ring-1 ring-inset ring-warn/50', className)}>No Match</span>;
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 font-semibold whitespace-nowrap', PARTNER_SOFT[slot], PARTNER_TEXT[slot], className)} title={side.name}>
      {side.short}
    </span>
  );
}

/** A whole pair inside a sentence: two joined chips, partner 1's first. */
export function PairChip({ pair, names, className }: { pair: PairView; names?: [string, string]; className?: string }) {
  const label = names ? `${names[0]}: ${pair.sides[0]?.name ?? 'No Match'}; ${names[1]}: ${pair.sides[1]?.name ?? 'No Match'}` : undefined;
  return (
    <span className={cn('inline-flex max-w-full overflow-hidden rounded-lg align-middle leading-normal', className)} title={label}>
      {pair.sides.map((s, k) => (
        <span
          key={k}
          className={cn('min-w-0 truncate px-1.5 py-0.5 font-semibold', s ? [PARTNER_SOFT[k], PARTNER_TEXT[k]] : 'bg-warn-soft text-warn')}
        >
          {s?.short ?? 'No Match'}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Small

/** The two short names, partner 1 on top (or in the first column with `columns`). */
export function PairNames({ pair, columns = false, className }: { pair: PairView; columns?: boolean; className?: string }) {
  return (
    <span className={cn('grid min-w-0 justify-items-start text-left', columns ? 'grid-cols-1 sm:grid-cols-2 sm:gap-3' : 'grid-cols-1', className)}>
      {pair.sides.map((s, k) => (
        <span key={k} className={cn('block w-full min-w-0 truncate text-sm font-semibold', s ? PARTNER_TEXT[k] : 'text-warn')} title={s?.name}>
          {s?.short ?? 'No Match'}
        </span>
      ))}
    </span>
  );
}

/** A compact pair with its rank and distance, e.g. in a conflict statement. */
export function PairTile({ pair, rank, className }: { pair: PairView; rank?: number | null; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3 rounded-[14px] border border-border bg-surface px-3 py-2', className)}>
      {rank !== undefined ? <span className="font-mono text-[13px] font-semibold tabular-nums text-plum-deep">{rank ? `#${rank}` : '–'}</span> : null}
      <PairNames pair={pair} className="flex-1" />
      <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} className="hidden sm:inline-flex" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Medium

/** Full details of a pair: both programs in full, codes, tiers, distance and why it's where it is. */
export function PairMedium({
  pair,
  names,
  hideTierOf = null,
  heading,
  why,
  children,
  className,
}: {
  pair: PairView;
  names: [string, string];
  hideTierOf?: Slot | null;
  heading?: ReactNode;
  why?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 text-left', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heading ? <span className="eyebrow text-muted">{heading}</span> : <span />}
        <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} />
      </div>
      {pair.sides.map((s, k) => (
        <div key={k} className={cn('flex flex-col gap-0.5 border-l-[3px] pl-3', PARTNER_BAR[k])}>
          <span className={cn('eyebrow', PARTNER_EYEBROW[k])}>{eyebrow(names[k], s, hideTierOf !== k)}</span>
          {s ? (
            <>
              <span className="font-display text-[15.5px] leading-snug font-semibold">{s.short}</span>
              {s.short !== s.name ? <span className="text-[13px] leading-snug text-muted">{s.name}</span> : null}
              <span className="text-[13px] text-muted">
                {s.place}
                {s.place ? ' · ' : ''}
                {s.code ? <span className="font-mono">{s.code}</span> : <span className="text-warn">no NRMP code yet</span>}
              </span>
            </>
          ) : (
            <span className="font-display text-[15.5px] font-semibold text-warn">No Match</span>
          )}
        </div>
      ))}
      {why ? (
        <div className="rounded-[14px] bg-surface-2 px-3 py-2 text-[13px] leading-relaxed">
          <span className="font-semibold">Why here: </span>
          {why}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * A small pair that opens its medium card: on hover (with a pointer), on keyboard focus,
 * and on tap. Escape or a click outside closes it.
 */
export function PairDetails({ label, trigger, children, className }: { label: string; trigger: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  function close() {
    pinned.current = false;
    setOpen(false);
  }
  const hover = (on: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || pinned.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(on), on ? 250 : 150);
  };

  return (
    <div ref={root} className={cn('relative min-w-0', className)} onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
      <button
        type="button"
        className="block w-full min-w-0 rounded-[10px] text-left outline-offset-2"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => {
          pinned.current = !open;
          setOpen(!open);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className="absolute top-full left-0 z-40 mt-2 w-[min(380px,calc(100vw-2.5rem))] rounded-[20px] border border-border bg-surface p-4 shadow-glass"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Large

/** The big card: map, then each partner's program with avatar, rank and tier; the distance between. */
export function PairLarge({
  pair,
  names,
  hideTierOf = null,
  action,
  highlight,
  tag,
  map = true,
  className,
}: {
  pair: PairView;
  names: [string, string];
  /** Partner (0 = A, 1 = B) whose tiers are private to me, if any. */
  hideTierOf?: Slot | null;
  action?: ReactNode;
  highlight?: boolean;
  /** A label in the top corner ("You picked this", "Cecil picked this"). */
  tag?: ReactNode;
  map?: boolean;
  className?: string;
}) {
  const points = pair.sides.flatMap((s) => (s && s.lat != null && s.lon != null ? [{ lat: s.lat, lon: s.lon }] : []));
  return (
    <div className={cn('glass glass-strong flex flex-col overflow-hidden', highlight && 'ring-2 ring-action/40', className)}>
      {map ? (
        <MiniMap points={points} className="h-32 w-full bg-surface-2 sm:h-40" label={`Map: ${pair.sides.map((s) => s?.place ?? 'No Match').join(' and ')}`} />
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        {tag ? <div className="flex justify-end">{tag}</div> : null}
        {pair.sides.map((side, k) => (
          <div key={k} className="flex flex-col gap-2">
            {k === 1 ? (
              <div className="flex items-center gap-2 pl-3">
                <span className="h-6 border-l-2 border-dashed border-border" aria-hidden />
                <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} />
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <Avatar name={names[k]} slot={k === 0 ? 1 : 2} className="mt-0.5" />
              <div className="min-w-0">
                <p className={cn('eyebrow', PARTNER_EYEBROW[k])}>{eyebrow(names[k], side, hideTierOf !== k)}</p>
                {side ? (
                  <>
                    <p className="mt-1 font-display text-lg leading-snug font-semibold" title={side.name}>{side.short}</p>
                    {side.short !== side.name ? <p className="text-xs leading-snug text-muted">{side.name}</p> : null}
                    <p className="text-sm text-muted">{side.place}</p>
                  </>
                ) : (
                  <p className="mt-1 font-display text-lg font-semibold text-warn">No Match</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {action ? <div className="mt-auto pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** A coloured "who picked this" tag for a large card. */
export function PickedTag({ name, slot, you }: { name: string; slot: Slot | null; you?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-semibold',
        slot === null ? 'bg-action pl-3 text-action-fg' : [PARTNER_SOFT[slot], PARTNER_TEXT[slot]],
      )}
    >
      {slot !== null ? <Avatar name={name} slot={slot === 0 ? 1 : 2} size="sm" /> : null}
      {you ? 'You picked this' : `${name} picked this`}
    </span>
  );
}
