'use client';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CoupleData, StoredSettings } from '@pairwise/db';
import { useDroppable } from '@dnd-kit/core';
import { NRMP_RULES, type MatchType } from '@pairwise/engine';
import { CircleAlert, CircleCheck, Download, GripVertical, History, Info, Lock, Map as MapIcon, Plus, Printer, Save, Search, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useId, useMemo, useRef, useState } from 'react';
import { BAND_NAME, BAND_ROW, BandBadge } from '@/components/proximity';
import { Button, buttonVariants } from '@/components/ui/button';
import { FloatingCoffee } from '@/components/coffee-button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { toCsv } from '@/lib/csv-export';
import { checklistFor, feesFor, RANK_LIMIT, type AvailablePair, type ListRow, type MoveResult } from '@/lib/final-list';
import { useEngine, useFinalList } from '@/lib/use-analysis';
import { breakLink } from '../conflicts/actions';
import { addDragPin, removePin, saveVersion, setIncluded, setListLength, setNoMatchUnlocked } from './actions';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function ListView({
  data,
  names,
  matchType,
  storedLength,
}: {
  data: CoupleData;
  names: [string, string];
  matchType: MatchType;
  storedLength: number;
}) {
  const [localPins, setLocalPins] = useState<CoupleData['pins']>([]);
  // List settings changed here, shown at once (the server copy catches up on revalidate).
  const [local, setLocal] = useState<{ included?: string[]; unlocked?: boolean; length?: number }>({});
  const stored = (data.couple.settings ?? {}) as StoredSettings;
  const settings = useMemo<StoredSettings>(
    () => ({
      ...stored,
      listLength: local.length ?? stored.listLength ?? storedLength,
      includedPairs: local.included ?? stored.includedPairs ?? [],
      noMatchUnlocked: local.unlocked ?? !!stored.noMatchUnlocked,
    }),
    [stored, local, storedLength],
  );
  const merged = useMemo(() => {
    const ids = new Set(data.pins.map((p) => p.id));
    return {
      ...data,
      couple: { ...data.couple, settings: settings as never },
      pins: [...data.pins, ...localPins.filter((p) => !ids.has(p.id))],
    };
  }, [data, localPins, settings]);
  const opts = useMemo(() => ({ names, matchType }), [names, matchType]);
  const { result, busy } = useFinalList(merged, opts);
  const call = useEngine();
  const toast = useToast();
  const dndId = useId();

  const lengthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ higher: string; lower: string; moved: 'higher' | 'lower'; include?: string; res: Extract<MoveResult, { ok: false }> } | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [coffee, setCoffee] = useState(false); // the coffee button, floated after a CSV export

  const rows = result?.rows ?? [];
  const n = result?.length ?? 0; // rows that count (first RANK_LIMIT)
  const over = Math.max(0, rows.length - RANK_LIMIT);
  const fees = useMemo(() => (result ? feesFor(result.rows, n) : null), [result, n]);
  const checklist = useMemo(() => (result ? checklistFor(result.rows, n, names, result.hasCycles) : []), [result, n, names]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function savePin(higher: string, lower: string, moved: 'higher' | 'lower') {
    const res = await addDragPin(higher, lower, moved);
    if (res.error || !res.id) return toast({ message: `Couldn’t save: ${res.error}` });
    const id = res.id;
    setLocalPins((xs) => [...xs, { id, higher_pair: higher, lower_pair: lower, source: 'manual_drag', comparison_id: null, moved_pair: moved }]);
    toast({
      message: 'Moved. Saved as your ordering.',
      action: {
        label: 'Undo',
        onClick: async () => {
          setLocalPins((xs) => xs.filter((p) => p.id !== id));
          await removePin(id);
        },
      },
    });
  }

  async function include(pairId: string, on: boolean) {
    const ids = new Set(settings.includedPairs ?? []);
    if (on) ids.add(pairId);
    else ids.delete(pairId);
    setLocal((l) => ({ ...l, included: [...ids] }));
    const res = await setIncluded(pairId, on);
    if (res.error) toast({ message: `Couldn’t save: ${res.error}` });
  }

  /** A pair from "Not on your list" dropped onto a row: it goes on the list, just above that row. */
  async function addAt(pairId: string, targetId: string | null) {
    const target = targetId ? rows.find((r) => r.pairId === targetId) : null;
    if (!target || target.locked) {
      await include(pairId, true); // dropped at the end: it joins in its own place
      return toast({ message: 'Added to your list.' });
    }
    const check = await call({ kind: 'move', data: merged, moving: pairId, target: target.pairId, names, moved: 'higher' });
    if (!check.ok) return setBlocked({ higher: pairId, lower: target.pairId, moved: 'higher', include: pairId, res: check });
    await include(pairId, true);
    await savePin(pairId, target.pairId, 'higher');
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!result || !e.over || e.active.id === e.over.id) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    if (activeId.startsWith('avail:')) return addAt(activeId.slice(6), overId === 'list-end' ? null : overId);
    if (overId === 'list-end') return;
    const from = rows.findIndex((r) => r.pairId === activeId);
    const to = rows.findIndex((r) => r.pairId === overId);
    if (from < 0 || to < 0) return;
    if (rows[to].locked) return toast({ message: 'No Match rows are locked at the end. Unlock them to move rows among them.' });
    // Dropped above the row it's over (moving up) or below it (moving down).
    const up = to < from;
    const [higher, lower] = up ? [activeId, overId] : [overId, activeId];
    const moved = up ? 'higher' : 'lower';
    const check = await call({ kind: 'move', data: merged, moving: higher, target: lower, names, moved });
    if (check.ok) await savePin(higher, lower, moved);
    else setBlocked({ higher, lower, moved, res: check });
  }

  if (!result) return <div className="h-96 animate-pulse rounded-2xl bg-surface-2" aria-label="Loading" />;
  if (!result.rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
        Your list appears here once you’ve both ranked programs.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {coffee ? <FloatingCoffee onClose={() => setCoffee(false)} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Final list</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your couple’s rank list, in order. Drag a row to move it — if a rule you set blocks the move, we’ll say why.
            Pairs not on the list are in “Not on your list”: drag one in, or add it. Enter it into R3 exactly as shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/map" className={buttonVariants({ variant: 'secondary' })}>
            <MapIcon className="h-4 w-4" aria-hidden /> Map
          </Link>
          <Link href="/app/versions" className={buttonVariants({ variant: 'secondary' })}>
            <History className="h-4 w-4" aria-hidden /> Versions
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              download(`couples-list-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.slice(0, RANK_LIMIT), names));
              setCoffee(true);
            }}
          >
            <Download className="h-4 w-4" aria-hidden /> CSV
          </Button>
          <Link href="/app/list/print" className={buttonVariants({ variant: 'secondary' })}>
            <Printer className="h-4 w-4" aria-hidden /> Print / PDF
          </Link>
        </div>
      </div>

      {blocked ? (
        <div role="alertdialog" aria-labelledby="blocked-title" className="rounded-2xl border border-warn bg-warn-soft p-4">
          <p id="blocked-title" className="font-medium text-warn">That move goes against something you set:</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {blocked.res.blocking.map((l, i) => (
              <li key={i}>{l.text}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const b = blocked;
                setBlocked(null);
                for (const link of b.res.blocking) {
                  const r = await breakLink({ from: link.from, to: link.to, reasons: link.reasons });
                  if (r.error) return toast({ message: `Couldn’t override: ${r.error}` });
                }
                if (b.include) await include(b.include, true);
                await savePin(b.higher, b.lower, b.moved);
              }}
            >
              Override with an exception
            </Button>
            <Button variant="secondary" onClick={() => setBlocked(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Ranked pairs" className={cn('min-w-0', busy && 'opacity-70')}>
          <div className="mb-2 hidden grid-cols-[2.5rem_1.5rem_1fr_1fr_auto] gap-3 px-3 text-xs font-medium text-muted sm:grid">
            <span>#</span>
            <span />
            <span>{names[0]}</span>
            <span>{names[1]}</span>
            <span>Distance</span>
          </div>
          <SortableContext items={rows.map((r) => r.pairId)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1.5" data-testid="final-list">
              {rows.map((r) => (
                <Fragment key={r.pairId}>
                  {r.rank === RANK_LIMIT + 1 ? (
                    <li role="separator" className="my-1 flex items-center gap-2 text-xs font-medium text-warn" data-testid="limit-line">
                      <span className="h-px flex-1 bg-warn" aria-hidden />
                      NRMP limit: rows below #{RANK_LIMIT} won’t be submitted
                      <span className="h-px flex-1 bg-warn" aria-hidden />
                    </li>
                  ) : null}
                  <Row
                    row={r}
                    overLimit={r.rank > RANK_LIMIT}
                    open={openWhy === r.pairId}
                    onWhy={() => setOpenWhy(openWhy === r.pairId ? null : r.pairId)}
                    onRemove={r.added ? () => void include(r.pairId, false) : undefined}
                  />
                </Fragment>
              ))}
            </ol>
          </SortableContext>
          <ListEnd />
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="p-4 sm:p-4">
            <Field
              label={`List length: ${result.target} rank${result.target === 1 ? '' : 's'}`}
              htmlFor="length"
              hint={`Pairs where you both match, then the No Match rows. NRMP allows ${RANK_LIMIT}.${
                rows.length !== result.target ? ` Pairs you added make it ${rows.length}.` : ''
              }`}
            >
              <input
                id="length"
                type="range"
                min={result.minTarget}
                max={result.maxTarget}
                value={result.target}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocal((l) => ({ ...l, length: v }));
                  if (lengthTimer.current) clearTimeout(lengthTimer.current);
                  lengthTimer.current = setTimeout(() => void setListLength(v), 500);
                }}
                className="w-full accent-[var(--accent)]"
              />
            </Field>
            <div className="mt-3 flex items-center justify-between gap-3">
              <label htmlFor="nm-lock" className="text-sm">
                <span className="font-medium">Keep No Match rows at the end</span>
                <span className="block text-xs text-muted">Locked in order: {names[0]} matches first, then {names[1]}.</span>
              </label>
              <Switch
                id="nm-lock"
                label="Keep No Match rows locked at the end"
                checked={result.noMatchLocked}
                onChange={async (locked) => {
                  setLocal((l) => ({ ...l, unlocked: !locked }));
                  const res = await setNoMatchUnlocked(!locked);
                  if (res.error) toast({ message: `Couldn’t save: ${res.error}` });
                }}
              />
            </div>
          </Card>

          <AvailablePanel pairs={result.available} names={names} onAdd={(id) => void include(id, true).then(() => toast({ message: 'Added to your list.' }))} />

          {fees ? (
            <Card className="p-4 sm:p-4" data-testid="fees">
              <h2 className="mb-2 font-semibold">Fee estimate</h2>
              <dl className="flex flex-col gap-3 text-sm">
                {fees.partners.map((p, k) => (
                  <div key={k}>
                    <dt className="font-medium">{names[k]}: ${p.totalUsd}</dt>
                    <dd className="text-xs text-muted">
                      {p.uniqueCodes} unique program codes ({NRMP_RULES.includedUniqueCodes} included) · extra ranks ${p.extraRankFeeUsd} · list
                      length ${p.lengthFeeUsd} · couples fee ${p.couplesFeeUsd}
                    </dd>
                  </div>
                ))}
              </dl>
              {fees.tierWarning ? (
                <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
                  Cutting {fees.tierWarning.pairsToCut} pair{fees.tierWarning.pairsToCut === 1 ? '' : 's'} would save $
                  {fees.tierWarning.saveUsdPerPartner} each.
                </p>
              ) : null}
              <p className="mt-3 text-xs text-muted">
                Estimate only, from rules not yet verified against nrmp.org. Base registration fees not included.
              </p>
            </Card>
          ) : null}

          <Card className="p-4 sm:p-4" data-testid="checklist">
            <h2 className="mb-2 font-semibold">Before you certify in R3</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex gap-2">
                  {c.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Done" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="To do" />}
                  <span>
                    {c.label}
                    {c.detail ? <span className="block text-xs text-muted">{c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {result.trades.length ? (
            <Card className="p-4 sm:p-4">
              <h2 className="mb-2 font-semibold">What you’re trading</h2>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs text-muted">
                {result.trades.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-4 sm:p-4">
            <h2 className="mb-2 font-semibold">Save a version</h2>
            <form
              className="flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                const res = await saveVersion(versionName, versionNote, result.target);
                setSaving(false);
                if (res.error) toast({ message: res.error });
                else {
                  toast({ message: `Saved “${versionName.trim()}”.` });
                  setVersionName('');
                  setVersionNote('');
                }
              }}
            >
              <Input aria-label="Version name" placeholder="e.g. After our Sunday talk" value={versionName} onChange={(e) => setVersionName(e.target.value)} required maxLength={120} />
              <Input aria-label="Version note" placeholder="Note (optional)" value={versionNote} onChange={(e) => setVersionNote(e.target.value)} />
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" aria-hidden /> {saving ? 'Saving…' : 'Save version'}
              </Button>
            </form>
          </Card>
        </aside>
      </div>
      </DndContext>

      {over > 0 ? (
        <div
          role="status"
          data-testid="over-limit"
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-warn bg-warn-soft px-3 py-2 text-xs font-medium text-warn shadow-lg sm:px-4 sm:text-sm"
        >
          <TriangleAlert className="h-4 w-4" aria-hidden />
          {rows.length} / {RANK_LIMIT} — {over} over the limit
        </div>
      ) : null}
    </div>
  );
}

function Row({ row, open, onWhy, overLimit, onRemove }: { row: ListRow; open: boolean; onWhy: () => void; overLimit: boolean; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.pairId, disabled: row.locked });
  const name = BAND_NAME[row.band];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-xl border px-2 py-2',
        BAND_ROW[row.band],
        overLimit && 'opacity-45 grayscale',
        isDragging && 'relative z-10 opacity-80 shadow-lg',
      )}
      data-band={row.band}
      data-over-limit={overLimit || undefined}
    >
      <div className="grid grid-cols-[2.5rem_1.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[2.5rem_1.5rem_1fr_1fr_auto]">
        <span className="text-right text-sm font-semibold tabular-nums">
          {row.rank}
          {overLimit ? <span className="sr-only"> (past the {RANK_LIMIT}-rank limit, won’t be submitted)</span> : null}
        </span>
        {row.locked ? (
          <span className="flex min-h-11 items-center justify-center text-muted" title="Locked at the end of the list">
            <Lock className="h-4 w-4" aria-label="Locked" />
          </span>
        ) : (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="flex min-h-11 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-2"
            aria-label={`Drag rank ${row.rank}`}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        )}
        {row.sides.map((s, k) => (
          <div key={k} className={cn('min-w-0', k === 1 && 'col-start-3 sm:col-start-auto')}>
            <p className={cn('truncate text-sm', name)} title={s.name}>{s.name}</p>
            <p className="truncate text-xs text-muted">
              {s.code ? <span className="font-mono">{s.code}</span> : <span className="text-warn">no code yet</span>}
              {s.place ? ` · ${s.place}` : ''}
            </p>
          </div>
        ))}
        <div className="col-start-3 flex items-center gap-1 sm:col-start-auto">
          <BandBadge band={row.band} bandLabel={row.bandLabel} distanceMi={row.distanceMi} />
          <button
            className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            onClick={onWhy}
            aria-expanded={open}
            aria-label={`Why is rank ${row.rank} here?`}
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
          {onRemove ? (
            <button
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              onClick={onRemove}
              aria-label={`Take rank ${row.rank} off the list`}
              title="You added this pair. Take it off the list."
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {open ? <p className="mt-2 ml-[4.75rem] text-xs text-text">{row.why}</p> : null}
    </li>
  );
}

/** Drop zone under the last row: a pair dropped here joins the list in its own place. */
function ListEnd() {
  const { setNodeRef, isOver } = useDroppable({ id: 'list-end' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-2 rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted',
        isOver && 'border-accent bg-accent-soft text-accent',
      )}
    >
      Drop a pair from “Not on your list” onto a row to put it there, or here to add it in its own place.
    </div>
  );
}

const PANEL_SHOWN = 50;

/** "Not on your list": every pair where both match that isn't on the list, searchable, draggable onto it. */
function AvailablePanel({ pairs, names, onAdd }: { pairs: AvailablePair[]; names: [string, string]; onAdd: (pairId: string) => void }) {
  const [q, setQ] = useState('');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length
    ? pairs.filter((p) => {
        const text = `${p.sides[0].name} ${p.sides[0].short} ${p.sides[0].place} ${p.sides[1].name} ${p.sides[1].short} ${p.sides[1].place}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : pairs;
  return (
    <Card className="p-4 sm:p-4" data-testid="available">
      <h2 className="font-semibold">Not on your list</h2>
      <p className="mt-0.5 text-xs text-muted">
        {pairs.length} other pair{pairs.length === 1 ? '' : 's'}, best first. Drag one onto the list, or add it.
      </p>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Search pairs not on your list" placeholder="Search programs or cities" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>
      <ul className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
        {hits.slice(0, PANEL_SHOWN).map((p) => (
          <AvailableItem key={p.pairId} pair={p} names={names} onAdd={() => onAdd(p.pairId)} />
        ))}
        {hits.length === 0 ? <li className="px-1 py-2 text-xs text-muted">{pairs.length ? 'No pairs match that search.' : 'Every pair is already on your list.'}</li> : null}
      </ul>
      {hits.length > PANEL_SHOWN ? <p className="mt-1 text-xs text-muted">Showing {PANEL_SHOWN} of {hits.length}. Search to narrow it down.</p> : null}
    </Card>
  );
}

function AvailableItem({ pair, names, onAdd }: { pair: AvailablePair; names: [string, string]; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `avail:${pair.pairId}` });
  const label = `${names[0]}: ${pair.sides[0].name}; ${names[1]}: ${pair.sides[1].name}`;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('flex items-center gap-1 rounded-lg border border-border bg-surface px-1 py-1', isDragging && 'relative z-20 shadow-lg')}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex min-h-9 min-w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-2"
        aria-label={`Drag onto the list: ${label}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1" title={label}>
        <p className="truncate text-xs font-medium">{pair.sides[0].short}</p>
        <p className="truncate text-xs font-medium">{pair.sides[1].short}</p>
      </div>
      <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} className="hidden xl:inline-flex" />
      <button
        onClick={onAdd}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        aria-label={`Add to the list: ${label}`}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
