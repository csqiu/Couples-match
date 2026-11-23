'use client';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CoupleData } from '@pairwise/db';
import { NRMP_RULES, type MatchType } from '@pairwise/engine';
import { CircleAlert, CircleCheck, Download, GripVertical, History, Info, Printer, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BAND_NAME, BAND_ROW, BandBadge } from '@/components/proximity';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { toCsv } from '@/lib/csv-export';
import { checklistFor, feesFor, type ListRow, type MoveResult } from '@/lib/final-list';
import { useEngine, useFinalList } from '@/lib/use-analysis';
import { breakLink } from '../conflicts/actions';
import { addDragPin, removePin, saveVersion, setListLength } from './actions';

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
  const merged = useMemo(() => {
    const ids = new Set(data.pins.map((p) => p.id));
    return { ...data, pins: [...data.pins, ...localPins.filter((p) => !ids.has(p.id))] };
  }, [data, localPins]);
  const opts = useMemo(() => ({ names, matchType }), [names, matchType]);
  const { result, busy } = useFinalList(merged, opts);
  const call = useEngine();
  const toast = useToast();
  const dndId = useId();

  const [length, setLength] = useState(storedLength);
  useEffect(() => setLength(storedLength), [storedLength]);
  const lengthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ higher: string; lower: string; res: Extract<MoveResult, { ok: false }> } | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [saving, setSaving] = useState(false);

  const max = result ? result.rows.length : 0;
  const n = Math.min(length, max);
  const rows = result ? result.rows.slice(0, n) : [];
  const fees = useMemo(() => (result ? feesFor(result.rows, n) : null), [result, n]);
  const checklist = useMemo(() => (result ? checklistFor(result.rows, n, names, result.hasCycles) : []), [result, n, names]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function savePin(higher: string, lower: string) {
    const res = await addDragPin(higher, lower);
    if (res.error || !res.id) return toast({ message: `Couldn’t save: ${res.error}` });
    const id = res.id;
    setLocalPins((xs) => [...xs, { id, higher_pair: higher, lower_pair: lower, source: 'manual_drag', comparison_id: null }]);
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

  async function onDragEnd(e: DragEndEvent) {
    if (!result || !e.over || e.active.id === e.over.id) return;
    const from = rows.findIndex((r) => r.pairId === e.active.id);
    const to = rows.findIndex((r) => r.pairId === e.over!.id);
    // Dropped above the row it's over (moving up) or below it (moving down).
    const [higher, lower] = to < from ? [String(e.active.id), String(e.over.id)] : [String(e.over.id), String(e.active.id)];
    const check = await call({ kind: 'move', data: merged, moving: higher, target: lower, names });
    if (check.ok) await savePin(higher, lower);
    else setBlocked({ higher, lower, res: check });
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Final list</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your couple’s rank list, in order. Drag a row to move it — if a rule you set blocks the move, we’ll say why.
            Enter it into R3 exactly as shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/versions" className={buttonVariants({ variant: 'secondary' })}>
            <History className="h-4 w-4" aria-hidden /> Versions
          </Link>
          <Button variant="secondary" onClick={() => download(`couples-list-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, names))}>
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
                await savePin(b.higher, b.lower);
              }}
            >
              Override with an exception
            </Button>
            <Button variant="secondary" onClick={() => setBlocked(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Ranked pairs" className={cn('min-w-0', busy && 'opacity-70')}>
          <div className="mb-2 hidden grid-cols-[2.5rem_1.5rem_1fr_1fr_auto] gap-3 px-3 text-xs font-medium text-muted sm:grid">
            <span>#</span>
            <span />
            <span>{names[0]}</span>
            <span>{names[1]}</span>
            <span>Distance</span>
          </div>
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.pairId)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-1.5" data-testid="final-list">
                {rows.map((r) => (
                  <Row key={r.pairId} row={r} open={openWhy === r.pairId} onWhy={() => setOpenWhy(openWhy === r.pairId ? null : r.pairId)} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="p-4 sm:p-4">
            <Field
              label={`List length: ${n} rank${n === 1 ? '' : 's'}`}
              htmlFor="length"
              hint={`Up to ${Math.min(max, NRMP_RULES.maxRanksPerPartner)} pairs available (NRMP allows ${NRMP_RULES.maxRanksPerPartner}).`}
            >
              <input
                id="length"
                type="range"
                min={1}
                max={max}
                value={n}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLength(v);
                  if (lengthTimer.current) clearTimeout(lengthTimer.current);
                  lengthTimer.current = setTimeout(() => void setListLength(v), 500);
                }}
                className="w-full accent-[var(--accent)]"
              />
            </Field>
          </Card>

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
                const res = await saveVersion(versionName, versionNote);
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
    </div>
  );
}

function Row({ row, open, onWhy }: { row: ListRow; open: boolean; onWhy: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.pairId });
  const name = BAND_NAME[row.band];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, contentVisibility: 'auto', containIntrinsicSize: '0 64px' }}
      className={cn('rounded-xl border px-2 py-2', BAND_ROW[row.band], isDragging && 'relative z-10 opacity-80 shadow-lg')}
      data-band={row.band}
    >
      <div className="grid grid-cols-[2.5rem_1.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[2.5rem_1.5rem_1fr_1fr_auto]">
        <span className="text-right text-sm font-semibold tabular-nums">{row.rank}</span>
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex min-h-11 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-2"
          aria-label={`Drag rank ${row.rank}`}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        {row.sides.map((s, k) => (
          <div key={k} className={cn('min-w-0', k === 1 && 'col-start-3 sm:col-start-auto')}>
            <p className={cn('truncate text-sm', name)}>{s.name}</p>
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
        </div>
      </div>
      {open ? <p className="mt-2 ml-[4.75rem] text-xs text-text">{row.why}</p> : null}
    </li>
  );
}
