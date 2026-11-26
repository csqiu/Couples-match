'use client';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CoupleData, StoredSettings } from '@pairwise/db';
import { useDroppable } from '@dnd-kit/core';
import { NRMP_RULES, type MatchType } from '@pairwise/engine';
import { ArrowDownUp, CircleAlert, CircleCheck, Crosshair, Download, FlaskConical, GripVertical, History, Lock, Map as MapIcon, Plus, Printer, Save, Search, TriangleAlert, Undo2, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { PairDetails, PairMedium, PairNames, ProgramChip, WhyText } from '@/components/pair';
import { BAND_ROW, BandBadge } from '@/components/proximity';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { toCsv } from '@/lib/csv-export';
import { checklistFor, DEFAULT_LIST_ORDER, feesFor, RANK_LIMIT, type AvailablePair, type ListOrder, type ListRow, type MoveResult } from '@/lib/final-list';
import { useEngine, useFinalList } from '@/lib/use-analysis';
import { addDragPin, removePin, saveVersion, setIncluded, setListLength, setListOrder, setNoMatchUnlocked } from './actions';
import { allReachable, simulate, SimulatorPanel, type RowReach, type Scenario } from './simulator';

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
  nextVersion,
}: {
  data: CoupleData;
  names: [string, string];
  matchType: MatchType;
  storedLength: number;
  /** The number saving now would give, e.g. "3.2". */
  nextVersion: string | null;
}) {
  const [localPins, setLocalPins] = useState<CoupleData['pins']>([]);
  // List settings changed here, shown at once (the server copy catches up on revalidate).
  const [local, setLocal] = useState<{ included?: string[]; unlocked?: boolean; length?: number; order?: ListOrder }>({});
  const stored = (data.couple.settings ?? {}) as StoredSettings;
  const settings = useMemo<StoredSettings>(
    () => ({
      ...stored,
      listLength: local.length ?? stored.listLength ?? storedLength,
      includedPairs: local.included ?? stored.includedPairs ?? [],
      noMatchUnlocked: local.unlocked ?? !!stored.noMatchUnlocked,
      listOrder: local.order ?? stored.listOrder ?? DEFAULT_LIST_ORDER,
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
  // Local changes only bridge the gap until the server copy arrives (bug log #23). Once no save
  // is in flight, a new server copy wins, so a partner's changes show up here too.
  const pendingSaves = useRef(0);
  async function tracked<T>(work: Promise<T>): Promise<T> {
    pendingSaves.current++;
    try {
      return await work;
    } finally {
      pendingSaves.current--;
    }
  }
  useEffect(() => {
    if (pendingSaves.current === 0) setLocal({});
  }, [data.couple.settings]);
  // A move saved here stays until the server copy has it; one the server no longer has (undone
  // or resolved elsewhere) goes, once it's had time to arrive.
  const pinAddedAt = useRef(new Map<string, number>());
  useEffect(() => {
    const server = new Set(data.pins.map((p) => p.id));
    setLocalPins((xs) => xs.filter((p) => !server.has(p.id) && Date.now() - (pinAddedAt.current.get(p.id) ?? 0) < 15_000));
  }, [data.pins]);
  const opts = useMemo(() => ({ names, matchType }), [names, matchType]);
  const { result, busy } = useFinalList(merged, opts);
  const call = useEngine();
  const toast = useToast();
  const dndId = useId();

  const lengthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A move that clashes with a rule: kept where it was dropped, with Undo or Resolve (bug log #20). */
  const [clash, setClash] = useState<{ pinId: string; pairId: string; added: boolean; parts: Extract<MoveResult, { ok: false }>['parts'] } | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = result?.rows ?? [];
  const n = result?.length ?? 0; // rows that count (first RANK_LIMIT)
  const over = Math.max(0, rows.length - RANK_LIMIT);
  const fees = useMemo(() => (result ? feesFor(result.rows, n) : null), [result, n]);
  // "Try an outcome": the programs each partner could get into, and where the couple would match.
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const simRows = useMemo(() => rows.slice(0, n), [rows, n]);
  const sim = useMemo(() => (scenario ? simulate(simRows, scenario) : null), [simRows, scenario]);
  const checklist = useMemo(() => (result ? checklistFor(result.rows, n, names, result.hasCycles) : []), [result, n, names]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function savePin(higher: string, lower: string, moved: 'higher' | 'lower', quiet = false): Promise<string | null> {
    const res = await addDragPin(higher, lower, moved);
    if (res.error || !res.id) {
      toast({ message: `Couldn’t save: ${res.error}` });
      return null;
    }
    const id = res.id;
    pinAddedAt.current.set(id, Date.now());
    setLocalPins((xs) => [...xs, { id, higher_pair: higher, lower_pair: lower, source: 'manual_drag', comparison_id: null, moved_pair: moved }]);
    if (quiet) return id;
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
    return id;
  }

  /** The move goes against a rule: keep it where it was dropped and say so, with Undo and Resolve. */
  async function keepClashing(higher: string, lower: string, moved: 'higher' | 'lower', res: Extract<MoveResult, { ok: false }>, include?: string) {
    if (include) await includePair(include, true);
    const pinId = await savePin(higher, lower, moved, true);
    if (pinId) setClash({ pinId, pairId: moved === 'higher' ? higher : lower, added: !!include, parts: res.parts });
  }

  async function undoClash() {
    const c = clash;
    if (!c) return;
    setClash(null);
    setLocalPins((xs) => xs.filter((p) => p.id !== c.pinId));
    await removePin(c.pinId);
    if (c.added) await includePair(c.pairId, false);
  }

  async function includePair(pairId: string, on: boolean) {
    const ids = new Set(settings.includedPairs ?? []);
    if (on) ids.add(pairId);
    else ids.delete(pairId);
    setLocal((l) => ({ ...l, included: [...ids] }));
    const res = await tracked(setIncluded(pairId, on));
    if (res.error) toast({ message: `Couldn’t save: ${res.error}` });
  }

  /** A pair from "Not on your list" dropped onto a row: it goes on the list, just above that row. */
  async function addAt(pairId: string, targetId: string | null) {
    const target = targetId ? rows.find((r) => r.pairId === targetId) : null;
    if (!target || target.locked) {
      await includePair(pairId, true); // dropped at the end: it joins in its own place
      return toast({ message: 'Added to your list.' });
    }
    const check = await call({ kind: 'move', data: merged, moving: pairId, target: target.pairId, names, moved: 'higher' });
    if (!check.ok) return keepClashing(pairId, target.pairId, 'higher', check, pairId);
    await includePair(pairId, true);
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
    else await keepClashing(higher, lower, moved, check);
  }

  if (!result) return <div className="glass h-96 animate-pulse" aria-label="Loading" />;
  if (!result.rows.length) {
    return (
      <div className="glass p-10 text-center text-sm text-muted">
        Your list appears here once you’ve both ranked programs.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Final list</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your couple’s rank list, in order. Drag a row to move it — if a rule you set blocks the move, we’ll say why.
            Pairs not on the list are in “Not on your list”: drag one in, or add it. Enter it into R3 exactly as shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" aria-pressed={!!scenario} onClick={() => setScenario(scenario ? null : allReachable(result.programs))}>
            <FlaskConical className="h-4 w-4" aria-hidden /> Try an outcome
          </Button>
          <Link href="/app/compare?mode=specific" className={buttonVariants({ variant: 'outline' })}>
            <Crosshair className="h-4 w-4" aria-hidden /> Make a specific comparison
          </Link>
          <Link href="/app/map" className={buttonVariants({ variant: 'secondary' })}>
            <MapIcon className="h-4 w-4" aria-hidden /> Map
          </Link>
          <Link href="/app/versions" className={buttonVariants({ variant: 'secondary' })}>
            <History className="h-4 w-4" aria-hidden /> Versions
          </Link>
          <Button variant="secondary" onClick={() => download(`couples-list-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.slice(0, RANK_LIMIT), names))}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </Button>
          <Link href="/app/list/print" className={buttonVariants({ variant: 'secondary' })}>
            <Printer className="h-4 w-4" aria-hidden /> Print / PDF
          </Link>
        </div>
      </div>

      {scenario ? (
        <SimulatorPanel programs={result.programs} names={names} rows={simRows} scenario={scenario} onChange={setScenario} onClose={() => setScenario(null)} />
      ) : null}

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Ranked pairs" className={cn('glass min-w-0 p-2 sm:p-3', busy && 'opacity-70')}>
          <BandCounts rows={rows} />
          <div className="mt-1 mb-2 grid grid-cols-[2.25rem_1.5rem_minmax(0,1fr)_auto] gap-x-2 px-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase sm:grid-cols-[2.5rem_1.5rem_minmax(0,1fr)_11.5rem] sm:gap-x-3 sm:px-2">
            <span className="text-right">#</span>
            <span />
            <span className="grid grid-cols-1 sm:grid-cols-2 sm:gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-partner-1" aria-hidden />{names[0]}<span className="sm:hidden"> / {names[1]}</span></span>
              <span className="hidden items-center gap-1.5 sm:flex"><span className="h-2 w-2 rounded-full bg-partner-2" aria-hidden />{names[1]}</span>
            </span>
            <span className="text-right">Distance</span>
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
                    reach={sim ? sim.reach[r.rank - 1] ?? 'out' : undefined}
                    overLimit={r.rank > RANK_LIMIT}
                    names={names}
                    total={rows.length}
                    onRemove={r.added ? () => void includePair(r.pairId, false) : undefined}
                  />
                </Fragment>
              ))}
            </ol>
          </SortableContext>
          <ListEnd />
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4 sm:p-4">
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
                  // Pending from the first move of the slider, so a refresh can't snap it back mid-drag.
                  if (lengthTimer.current) clearTimeout(lengthTimer.current);
                  else pendingSaves.current++;
                  lengthTimer.current = setTimeout(() => {
                    lengthTimer.current = null;
                    void setListLength(v).finally(() => pendingSaves.current--);
                  }, 500);
                }}
                className="w-full accent-[var(--action)]"
              />
            </Field>
            <Field
              label="Show the list in"
              htmlFor="list-order"
              hint={
                result.order === 'engine'
                  ? 'The engine’s own order.'
                  : `Rows whose order can’t change where you match are sorted to read easily${result.tidied ? ` (${result.tidied} moved)` : ''}. The outcome is exactly the same.`
              }
            >
              <select
                id="list-order"
                className="min-h-[46px] w-full rounded-[14px] border border-border bg-glass-strong px-3.5 text-[15px] focus-visible:outline-action"
                value={result.order}
                onChange={async (e) => {
                  const order = e.target.value as ListOrder;
                  setLocal((l) => ({ ...l, order }));
                  const res = await tracked(setListOrder(order));
                  if (res.error) toast({ message: `Couldn’t save: ${res.error}` });
                }}
              >
                <option value="partner1">{names[0]}’s order first</option>
                <option value="partner2">{names[1]}’s order first</option>
                <option value="balanced">Both ranks together</option>
                <option value="engine">Engine order (no tidying)</option>
              </select>
            </Field>
            <div className="flex items-center justify-between gap-3">
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
                  const res = await tracked(setNoMatchUnlocked(!locked));
                  if (res.error) toast({ message: `Couldn’t save: ${res.error}` });
                }}
              />
            </div>
          </Card>

          <AvailablePanel pairs={result.available} names={names} onAdd={(id) => void includePair(id, true).then(() => toast({ message: 'Added to your list.' }))} />

          {fees ? (
            <Card className="p-4 sm:p-4" data-testid="fees">
              <h2 className="small-title mb-2">Fee estimate</h2>
              <dl className="flex flex-col gap-3 text-sm">
                {fees.partners.map((p, k) => (
                  <div key={k}>
                    <dt className="font-medium">{names[k]}: <span className="font-mono">${p.totalUsd}</span></dt>
                    <dd className="text-xs text-muted">
                      {p.uniqueCodes} unique program codes ({NRMP_RULES.includedUniqueCodes} included) · extra ranks ${p.extraRankFeeUsd} · list
                      length ${p.lengthFeeUsd} · couples fee ${p.couplesFeeUsd}
                    </dd>
                  </div>
                ))}
              </dl>
              {fees.tierWarning ? (
                <p className="mt-3 rounded-[12px] bg-warn-soft/85 px-3 py-2 text-xs text-warn">
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
            <h2 className="small-title mb-2">Before you certify in R3</h2>
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
            <Card tone="strong" className="p-4 sm:p-4">
              <h2 className="small-title mb-2">What you’re trading</h2>
              <ul className="flex flex-col gap-2 text-[13px] leading-relaxed">
                {result.trades.map((t) => (
                  <li key={`${t.rank}-${t.partner}`}>
                    <span className="font-mono font-semibold text-plum-deep">#{t.rank}</span> {names[t.partner]} gets{' '}
                    <ProgramChip side={t.got} slot={t.partner} /> ahead of <ProgramChip side={t.better} slot={t.partner} />{' '}
                    <span className="text-muted">(first at #{t.betterRank})</span>, because {t.because}.
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-4 sm:p-4">
            <h2 className="small-title mb-2">Save a version</h2>
            <form
              className="flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                const res = await saveVersion(versionName, versionNote, result.target);
                setSaving(false);
                if (res.error) toast({ message: res.error });
                else {
                  toast({ message: `Saved as ${res.label ?? 'a new version'}.` });
                  setVersionName('');
                  setVersionNote('');
                }
              }}
            >
              <Input aria-label="Version name" placeholder="Name (optional), e.g. After our Sunday talk" value={versionName} onChange={(e) => setVersionName(e.target.value)} maxLength={120} />
              <Input aria-label="Version note" placeholder="Note (optional)" value={versionNote} onChange={(e) => setVersionNote(e.target.value)} />
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" aria-hidden /> {saving ? 'Saving…' : nextVersion ? `Save as ${nextVersion}` : 'Save version'}
              </Button>
            </form>
          </Card>
        </aside>
      </div>
      </DndContext>

      <ClashNotice clash={clash} unresolved={result.hasCycles} names={names} onUndo={() => void undoClash()} onClose={() => setClash(null)} />

      {over > 0 ? (
        <div
          role="status"
          data-testid="over-limit"
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-warn bg-warn-soft px-3 py-2 text-xs font-medium text-warn shadow-glass sm:px-4 sm:text-sm"
        >
          <TriangleAlert className="h-4 w-4" aria-hidden />
          {rows.length} / {RANK_LIMIT} — {over} over the limit
        </div>
      ) : null}
    </div>
  );
}

function Row({
  row,
  names,
  total,
  overLimit,
  onRemove,
  reach,
}: {
  row: ListRow;
  names: [string, string];
  total: number;
  overLimit: boolean;
  onRemove?: () => void;
  reach?: RowReach;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.pairId, disabled: row.locked });
  const label = `Rank ${row.rank}: ${names[0]} ${row.pair.sides[0]?.name ?? 'No Match'}; ${names[1]} ${row.pair.sides[1]?.name ?? 'No Match'}. Show details.`;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-[16px] border px-1.5 py-1.5 sm:px-2',
        BAND_ROW[row.band],
        overLimit && 'opacity-45 grayscale',
        reach === 'out' && 'opacity-35 grayscale',
        reach === 'match' && 'ring-2 ring-action ring-offset-2 ring-offset-bg',
        isDragging && 'relative z-10 border-action bg-surface opacity-90 shadow-glass',
      )}
      data-band={row.band}
      data-over-limit={overLimit || undefined}
      data-reach={reach}
    >
      {reach === 'match' ? <p className="mb-1 ml-[4.25rem] text-xs font-semibold text-accent">You match here</p> : null}
      <div className="grid grid-cols-[2.25rem_1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 sm:grid-cols-[2.5rem_1.5rem_minmax(0,1fr)_11.5rem] sm:gap-x-3">
        <span className="text-right font-mono text-[15px] font-semibold tabular-nums text-plum-deep">
          {row.rank}
          {overLimit ? <span className="sr-only"> (past the {RANK_LIMIT}-rank limit, won’t be submitted)</span> : null}
          {reach === 'out' ? <span className="sr-only"> (out of reach in this outcome)</span> : null}
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
            className="flex min-h-11 cursor-grab touch-none items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong"
            aria-label={`Drag rank ${row.rank}`}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        )}
        <PairDetails
          label={label}
          trigger={<PairNames pair={row.pair} columns className="min-h-11 content-center py-1" />}
        >
          <PairMedium pair={row.pair} names={names} heading={`Rank ${row.rank} of ${total}`} why={<WhyText parts={row.whyParts} names={names} fallback={row.why} />}>
            <Link
              href={`/app/compare?mode=specific&a=${encodeURIComponent(row.pairId)}`}
              className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'self-start' })}
            >
              <ArrowDownUp className="h-4 w-4" aria-hidden /> Compare with another pair
            </Link>
          </PairMedium>
        </PairDetails>
        <div className="flex items-center justify-end gap-1">
          <BandBadge band={row.band} bandLabel={row.bandLabel} distanceMi={row.distanceMi} compact />
          {onRemove ? (
            <button
              className="flex min-h-9 min-w-9 items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong hover:text-text"
              onClick={onRemove}
              aria-label={`Take rank ${row.rank} off the list`}
              title="You added this pair. Take it off the list."
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** How many rows fall in each distance band (label and icon, not color alone). */
function BandCounts({ rows }: { rows: ListRow[] }) {
  const counts = new Map<ListRow['band'], { label: string; n: number }>();
  for (const r of rows) {
    const c = counts.get(r.band) ?? { label: r.bandLabel, n: 0 };
    c.n++;
    counts.set(r.band, c);
  }
  return (
    <ul className="flex flex-wrap gap-1.5 px-1 pt-1" aria-label="Rows by distance">
      {[...counts].map(([band, c]) => (
        <li key={band}>
          <BandBadge band={band} bandLabel={`${c.label} · ${c.n}`} distanceMi={null} />
        </li>
      ))}
    </ul>
  );
}

/** Drop zone under the last row: a pair dropped here joins the list in its own place. */
function ListEnd() {
  const { setNodeRef, isOver } = useDroppable({ id: 'list-end' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-2 rounded-[16px] border border-dashed border-border px-3 py-3 text-center text-xs text-muted',
        isOver && 'border-action bg-action-soft text-text',
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
      <h2 className="small-title">Not on your list</h2>
      <p className="mt-0.5 text-xs text-muted">
        {pairs.length} other pair{pairs.length === 1 ? '' : 's'}, best first. Drag one onto the list, or add it.
      </p>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Search pairs not on your list" placeholder="Search programs or cities" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
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
      className={cn('glass-row flex items-center gap-1 rounded-[12px] px-1 py-1', isDragging && 'relative z-20 border-action bg-surface shadow-glass')}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex min-h-9 min-w-7 cursor-grab touch-none items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong"
        aria-label={`Drag onto the list: ${label}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <PairNames pair={pair.pair} className="flex-1" />
      <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} compact />
      <button
        onClick={onAdd}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong hover:text-text"
        aria-label={`Add to the list: ${label}`}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

/**
 * Floating notice for a move that clashes with a rule (bug log #20). The row stays where it
 * was dropped; the couple can undo it, or resolve the clash on the Conflicts step. While any
 * clash is unresolved, a smaller notice stays up.
 */
function ClashNotice({
  clash,
  unresolved,
  names,
  onUndo,
  onClose,
}: {
  clash: { pinId: string; pairId: string; parts: Extract<MoveResult, { ok: false }>['parts'] } | null;
  unresolved: boolean;
  names: [string, string];
  onUndo: () => void;
  onClose: () => void;
}) {
  if (!clash && !unresolved) return null;
  const href = clash ? `/app/conflicts?pair=${encodeURIComponent(clash.pairId)}` : '/app/conflicts';
  return (
    <div
      role={clash ? 'alert' : 'status'}
      data-testid="clash-notice"
      className="fixed inset-x-4 bottom-16 z-30 rounded-[20px] border border-warn/60 bg-surface p-4 shadow-glass sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px]"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-warn">{clash ? 'Kept where you put it, but it clashes with something you set' : 'Your list has a conflict to resolve'}</p>
          {clash ? (
            <p className="mt-1 text-[13px]">
              <WhyText parts={clash.parts} names={names} />
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Rows involved stay where you put them until you choose what gives way.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {clash ? (
              <Button size="sm" variant="secondary" onClick={onUndo}>
                <Undo2 className="h-4 w-4" aria-hidden /> Undo move
              </Button>
            ) : null}
            <Link href={href} className={buttonVariants({ size: 'sm' })}>Resolve on Conflicts</Link>
          </div>
        </div>
        {clash ? (
          <button onClick={onClose} className="flex min-h-9 min-w-9 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2" aria-label="Hide this notice">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
