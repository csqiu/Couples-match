'use client';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isValidProgramCode } from '@pairwise/engine';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { TierBadge } from '@/components/ui/badge';
import { Select } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { findTier, flatten, group, moveTo, nudge, sameOrder, TIERS, type Board, type Tier } from '@/lib/board';
import { cn } from '@/lib/cn';
import { removeProgram } from '../programs/actions';
import { saveCode, saveList } from './actions';

export interface BoardEntry {
  programId: string;
  tier: Tier;
  acceptable: boolean;
  nrmpCode: string;
  /** From the NRMP directory: shown, not typed. */
  officialCode?: string;
  name: string;
  place: string;
}

/**
 * Keyboard dragging across the three tier lists: ↑/↓ jump to the nearest row (or empty
 * tier box) above or below, so a program can move between tiers without a mouse.
 * dnd-kit's default getter only handles a single list well.
 */
const tierAwareCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, collisionRect, droppableRects, droppableContainers } = args.context;
  if ((event.code !== 'ArrowUp' && event.code !== 'ArrowDown') || !active || !collisionRect) {
    return sortableKeyboardCoordinates(event, args);
  }
  event.preventDefault();
  const up = event.code === 'ArrowUp';
  let best: { top: number; left: number; d: number } | null = null;
  for (const c of droppableContainers.getEnabled()) {
    if (c.id === active.id) continue;
    const rect = droppableRects.get(c.id);
    if (!rect) continue;
    const d = up ? collisionRect.top - rect.top : rect.top - collisionRect.top;
    if (d > 1 && (!best || d < best.d)) best = { top: rect.top, left: rect.left, d };
  }
  return best ? { x: best.left, y: best.top } : undefined;
};

const TIER_COPY: Record<Tier, { title: string; body: string }> = {
  A: { title: 'Tier A', body: 'Almost no amount of distance would make me drop to Tier B. Use sparingly.' },
  B: { title: 'Tier B', body: 'Most of my programs. I’d take a lower Tier B program to be closer to my partner.' },
  C: { title: 'Tier C', body: 'My least favourite programs. I’d rather be long distance than match here. Use sparingly.' },
};

export function RankBoard({ initial }: { initial: BoardEntry[] }) {
  const [board, setBoard] = useState<Board<BoardEntry>>(() => group(initial));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startSave] = useTransition();
  const toast = useToast();
  const dragStart = useRef<Board<BoardEntry> | null>(null);
  // Stable id so dnd-kit's accessibility ids match between server and client render.
  const dndId = useId();

  // Live updates (e.g. from another tab) replace local state unless a drag is in progress.
  const initialKey = initial.map((e) => `${e.programId}:${e.tier}:${e.acceptable}:${e.nrmpCode}:${e.officialCode ?? ''}`).join('|');
  useEffect(() => {
    if (!activeId) setBoard(group(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const byId = useMemo(() => new Map(flatten(board).map((e) => [e.programId, e])), [board]);
  const rankOf = useMemo(() => new Map(flatten(board).map((e, i) => [e.programId, i + 1])), [board]);

  // What a move did, for screen readers only: on screen the list itself shows it (bug log #4).
  const [said, setSaid] = useState('');

  function persist(next: Board<BoardEntry>, prev: Board<BoardEntry>, message?: string) {
    setBoard(next);
    startSave(async () => {
      const res = await saveList(flatten(next).map(({ programId, tier, acceptable }) => ({ programId, tier, acceptable })));
      if (res.error) {
        setBoard(prev);
        toast({ message: `Couldn’t save: ${res.error}` });
      } else if (message) {
        setSaid(message);
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: tierAwareCoordinates }),
  );

  const containerOf = (id: string): Tier | null =>
    id.startsWith('zone-') ? (id.slice(5) as Tier) : findTier(board, id);

  const keyboardDrag = useRef(false);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    dragStart.current = board;
    keyboardDrag.current = e.activatorEvent instanceof KeyboardEvent;
  }

  function onDragOver(e: DragOverEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = containerOf(id);
    const to = containerOf(overId);
    if (!from || !to || from === to) return;
    // Crossing into a tier above lands at its end, into a tier below at its start — the same as
    // the arrow buttons. A pointer drop then fine-tunes the position within the tier on drag end.
    const up = TIERS.indexOf(to) < TIERS.indexOf(from);
    setBoard((b) => moveTo(b, id, to, up ? undefined : 0));
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    const start = dragStart.current ?? board;
    let next = board;
    const changedTier = findTier(start, id) !== findTier(board, id);
    // A keyboard move into another tier keeps its tier-edge placement (end of the tier above,
    // start of the tier below); otherwise drop where the item is over.
    if (overId && !overId.startsWith('zone-') && !(keyboardDrag.current && changedTier)) {
      const tier = findTier(board, id)!;
      if (findTier(board, overId) === tier) next = moveTo(board, id, tier, board[tier].findIndex((it) => it.programId === overId));
    }
    if (sameOrder(start, next)) return setBoard(next);
    const entry = byId.get(id)!;
    const toTier = findTier(next, id)!;
    persist(next, start, findTier(start, id) !== toTier ? `Moved ${entry.name} to Tier ${toTier}` : `Moved ${entry.name}`);
  }

  const active = activeId ? byId.get(activeId) : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        if (dragStart.current) setBoard(dragStart.current);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'To pick up a program, press space or enter. Use the arrow keys to move it, including into another tier. Press space or enter to drop, or escape to cancel.',
        },
      }}
    >
      <p className="sr-only" aria-live="polite">{said}</p>
      <div className="flex flex-col gap-4" data-testid="rank-board">
        {TIERS.map((tier) => (
          <TierZone key={tier} tier={tier} count={board[tier].length}>
            <SortableContext items={board[tier].map((e) => e.programId)} strategy={verticalListSortingStrategy}>
              {board[tier].map((entry) => (
                <Row
                  key={entry.programId}
                  entry={entry}
                  rank={rankOf.get(entry.programId)!}
                  isFirst={rankOf.get(entry.programId) === 1}
                  isLast={rankOf.get(entry.programId) === byId.size}
                  onNudge={(dir) => persist(nudge(board, entry.programId, dir), board)}
                  onTier={(t) => persist(moveTo(board, entry.programId, t), board, `Moved ${entry.name} to Tier ${t}`)}
                  onAcceptable={(v) => {
                    const next = { ...board, [tier]: board[tier].map((e) => (e.programId === entry.programId ? { ...e, acceptable: v } : e)) };
                    persist(next, board);
                  }}
                  onRemove={async () => {
                    const prev = board;
                    setBoard({ ...board, [tier]: board[tier].filter((e) => e.programId !== entry.programId) });
                    const res = await removeProgram(entry.programId);
                    if (res.error) {
                      setBoard(prev);
                      toast({ message: res.error });
                    } else toast({ message: `Removed ${entry.name}` });
                  }}
                />
              ))}
            </SortableContext>
          </TierZone>
        ))}
      </div>
      <DragOverlay>{active ? <RowCard entry={active} rank={rankOf.get(active.programId)!} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function TierZone({ tier, count, children }: { tier: Tier; count: number; children: React.ReactNode }) {
  // A tier box only takes drops itself while empty; otherwise its rows do. (If a non-empty
  // box were droppable, the keyboard's "up" from its first row would land on the box itself,
  // and keyboard users could never move a program into another tier.)
  const { setNodeRef, isOver } = useDroppable({ id: `zone-${tier}`, disabled: count > 0 });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`tier-${tier}`}
      className={cn(
        'glass min-w-0 p-3 sm:p-4',
        tier === 'A' ? 'bg-accent-soft/60' : tier === 'B' ? 'bg-partner-2-soft/55' : '',
        isOver && 'ring-2 ring-action/35',
      )}
    >
      <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
        <h2 id={`tier-${tier}`} className="card-title flex items-center gap-2">
          <TierBadge tier={tier} /> {TIER_COPY[tier].title} <span className="font-mono text-sm font-normal text-muted">({count})</span>
        </h2>
        <p className="text-sm text-muted">{TIER_COPY[tier].body}</p>
      </header>
      <ul className="flex min-h-14 flex-col gap-2" data-testid={`tier-${tier}`}>
        {children}
        {count === 0 ? (
          <li className="flex min-h-14 items-center justify-center rounded-[16px] border border-dashed border-border text-xs text-muted">
            Drag programs here
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function Row(props: {
  entry: BoardEntry;
  rank: number;
  isFirst: boolean;
  isLast: boolean;
  onNudge: (dir: -1 | 1) => void;
  onTier: (t: Tier) => void;
  onAcceptable: (v: boolean) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.programId,
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'opacity-40')}>
      <RowCard
        {...props}
        handle={
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong active:cursor-grabbing"
            aria-label={`Drag ${props.entry.name}`}
          >
            <GripVertical className="h-5 w-5" aria-hidden />
          </button>
        }
      />
    </li>
  );
}

function RowCard({
  entry,
  rank,
  overlay,
  handle,
  isFirst,
  isLast,
  onNudge,
  onTier,
  onAcceptable,
  onRemove,
}: {
  entry: BoardEntry;
  rank: number;
  overlay?: boolean;
  handle?: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  onNudge?: (dir: -1 | 1) => void;
  onTier?: (t: Tier) => void;
  onAcceptable?: (v: boolean) => void;
  onRemove?: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState(entry.nrmpCode);
  const [codeError, setCodeError] = useState<string | null>(null);
  useEffect(() => setCode(entry.nrmpCode), [entry.nrmpCode]);

  return (
    <div
      className={cn(
        'glass-row flex flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2 sm:flex-nowrap',
        overlay && '-rotate-[1.2deg] border-action bg-surface shadow-glass',
        !entry.acceptable && 'opacity-60',
      )}
    >
      {handle ?? <span className="flex min-h-11 w-8 items-center justify-center text-muted"><GripVertical className="h-5 w-5" aria-hidden /></span>}
      <span className="w-7 shrink-0 text-right font-mono text-[15px] font-semibold tabular-nums text-plum-deep" aria-label={`Rank ${rank}`}>{rank}</span>
      <div className="min-w-0 flex-1 basis-40">
        <p className={cn('truncate text-sm font-medium', !entry.acceptable && 'line-through')}>{entry.name}</p>
        <p className="truncate text-xs text-muted">{entry.place}{!entry.acceptable ? ' · not acceptable (left off your list)' : ''}</p>
      </div>
      {overlay ? null : (
        <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
          {entry.officialCode ? (
            <span
              className="inline-flex min-h-11 w-28 min-w-0 items-center px-2 font-mono text-xs text-muted"
              title="NRMP code from the official program directory"
            >
              <span className="sr-only">NRMP code </span>
              {entry.officialCode}
            </span>
          ) : (
            <>
            <label className="sr-only" htmlFor={`code-${entry.programId}`}>NRMP code for {entry.name}</label>
            <input
              id={`code-${entry.programId}`}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setCodeError(null);
              }}
              onBlur={async () => {
                if (code === entry.nrmpCode) return;
                if (code && !isValidProgramCode(code)) return setCodeError('9 or 10 characters, e.g. 1234140C0');
                const res = await saveCode(entry.programId, code);
                if (res.error) setCodeError(res.error);
                else toast({ message: code ? `Saved code ${code} for ${entry.name}` : `Cleared code for ${entry.name}` });
              }}
              placeholder="NRMP code"
              maxLength={10}
              aria-invalid={!!codeError}
              title={codeError ?? 'Type the program code from R3'}
              className={cn(
                'min-h-11 w-28 min-w-0 rounded-[12px] border bg-glass-strong px-2 font-mono text-xs uppercase placeholder:font-sans placeholder:normal-case',
                codeError ? 'border-danger' : 'border-border',
              )}
            />
            </>
          )}
          <Select
            aria-label={`Tier for ${entry.name}`}
            value={entry.tier}
            onChange={(e) => onTier?.(e.target.value as Tier)}
            className="min-h-11 w-16 shrink-0 bg-[right_8px_center] px-2.5 pr-7"
          >
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <span className="flex flex-col">
            <button className="flex h-5.5 w-9 items-center justify-center rounded-md text-muted hover:bg-glass-strong disabled:opacity-30" disabled={isFirst} onClick={() => onNudge?.(-1)} aria-label={`Move ${entry.name} up`}>
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
            <button className="flex h-5.5 w-9 items-center justify-center rounded-md text-muted hover:bg-glass-strong disabled:opacity-30" disabled={isLast} onClick={() => onNudge?.(1)} aria-label={`Move ${entry.name} down`}>
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </span>
          <Switch checked={entry.acceptable} onChange={(v) => onAcceptable?.(v)} label={`${entry.name} is acceptable`} />
          <button className="flex min-h-11 min-w-11 items-center justify-center rounded-[14px] text-muted hover:bg-glass-strong hover:text-danger" onClick={onRemove} aria-label={`Remove ${entry.name}`}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {codeError ? <p className="w-full pl-17 text-xs text-danger" role="alert">{codeError}</p> : null}
    </div>
  );
}
