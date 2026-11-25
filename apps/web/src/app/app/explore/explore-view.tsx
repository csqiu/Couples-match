'use client';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ComparisonRow, CoupleData } from '@pairwise/db';
import { ArrowDownUp, CircleAlert, GripVertical, Info, Lock, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo, useState, useTransition } from 'react';
import { BandBadge } from '@/components/proximity';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import type { ExploreDetail, ExplorePair, Impact } from '@/lib/explore';
import { useExplore } from '@/lib/use-analysis';
import { answer } from '../compare/actions';

type Slot = 'a' | 'b';
type LocalRow = Pick<ComparisonRow, 'id' | 'pair_left' | 'pair_right' | 'winner' | 'answered_by' | 'both_agreed' | 'locked' | 'seq'>;

const SHOWN = 80;

function pairText(p: ExplorePair) {
  return p.sides.map((s) => s?.short ?? 'No Match').join(' + ');
}

/**
 * Pick any two pairs ("this" and "that"): see how the list orders them and why, and
 * what answering either way would do before saving it.
 */
export function ExploreView({
  data,
  me,
  names,
  answerMode,
  initialA,
  initialB,
}: {
  data: CoupleData;
  me: string;
  names: [string, string];
  answerMode: 'together' | 'separately';
  initialA: string | null;
  initialB: string | null;
}) {
  const [a, setA] = useState<string | null>(initialA);
  const [b, setB] = useState<string | null>(initialB);
  const [local, setLocal] = useState<LocalRow[]>([]);
  const [, startSave] = useTransition();
  const toast = useToast();
  const dndId = useId();

  const merged = useMemo<CoupleData>(() => {
    const ids = new Set(data.comparisons.map((c) => c.id));
    return { ...data, comparisons: [...data.comparisons, ...local.filter((l) => !ids.has(l.id))] };
  }, [data, local]);
  const opts = useMemo(() => ({ me, names, a, b }), [me, names, a, b]);
  const { result, busy, error } = useExplore(merged, opts);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const put = (slot: Slot, id: string) => {
    if (slot === 'a') {
      if (id === b) setB(a);
      setA(id);
    } else {
      if (id === a) setA(b);
      setB(id);
    }
  };
  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const id = String(e.active.id).replace(/^pick:/, '');
    const over = String(e.over.id);
    if (over === 'slot-a') put('a', id);
    if (over === 'slot-b') put('b', id);
  }

  function choose(impact: Impact, strong: boolean) {
    const row: LocalRow = {
      id: `local-${Date.now()}`,
      pair_left: impact.higher,
      pair_right: impact.lower,
      winner: 'left',
      answered_by: me,
      both_agreed: answerMode === 'together',
      locked: strong,
      seq: Number.MAX_SAFE_INTEGER - 1000 + local.length,
    };
    setLocal((xs) => [...xs, row]);
    startSave(async () => {
      const res = await answer({ left: impact.higher, right: impact.lower, winner: 'left', certain: strong });
      if (res.error && !res.id) {
        setLocal((xs) => xs.filter((x) => x.id !== row.id));
        toast({ message: `Couldn’t save that answer: ${res.error}` });
        return;
      }
      setLocal((xs) => xs.map((x) => (x.id === row.id ? { ...x, id: res.id! } : x)));
      toast({ message: impact.conflicts.length ? 'Saved. It conflicts with something else: resolve it on the Conflicts step.' : 'Saved as your answer.' });
    });
  }

  if (error) return <p className="text-danger" role="alert">Something went wrong: {error}</p>;
  if (!result) return <div className="h-96 animate-pulse rounded-2xl bg-surface-2" aria-label="Loading" />;

  const byId = new Map(result.pairs.map((p) => [p.id, p]));
  const d = result.detail;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pick any two pairs to see how your list orders them and why. Before you answer, see what it would change: which
            rows move, and whether it clashes with anything you’ve said.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/compare" className={buttonVariants({ variant: 'secondary' })}>This or that</Link>
          <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Final list</Link>
        </div>
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Picker pairs={result.pairs} selected={[a, b]} onPut={put} />

          <section aria-label="Comparison" className={cn('flex min-w-0 flex-col gap-4', busy && 'opacity-70')}>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <SlotCard slot="a" label="This" pair={a ? byId.get(a) : undefined} names={names} onClear={() => setA(null)} />
              <div className="flex items-center justify-center">
                <Button variant="ghost" size="sm" disabled={!a && !b} onClick={() => { setA(b); setB(a); }} aria-label="Swap this and that">
                  <ArrowDownUp className="h-4 w-4" aria-hidden /> Swap
                </Button>
              </div>
              <SlotCard slot="b" label="That" pair={b ? byId.get(b) : undefined} names={names} onClear={() => setB(null)} />
            </div>
            {d ? <Detail d={d} onChoose={choose} busy={busy} /> : (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Drag two pairs into “This” and “That”, or use the arrows next to each pair.
              </p>
            )}
          </section>
        </div>
      </DndContext>
    </div>
  );
}

function Picker({ pairs, selected, onPut }: { pairs: ExplorePair[]; selected: [string | null, string | null]; onPut: (slot: Slot, id: string) => void }) {
  const [q, setQ] = useState('');
  const [offList, setOffList] = useState(false);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = pairs.filter((p) => {
    if (!offList && p.rank === null) return false;
    if (!words.length) return true;
    const text = p.sides.map((s) => (s ? `${s.name} ${s.short} ${s.place}` : 'no match')).join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  });
  return (
    <Card className="flex min-w-0 flex-col p-4 sm:p-4" data-testid="picker">
      <h2 className="font-semibold">Pairs</h2>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Search pairs" placeholder="Search programs or cities" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>
      <label className="mt-2 flex min-h-9 items-center gap-2 text-xs text-muted">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={offList} onChange={(e) => setOffList(e.target.checked)} />
        Include pairs not on your list
      </label>
      <ul className="mt-1 flex max-h-[32rem] flex-col gap-1 overflow-y-auto pr-1">
        {hits.slice(0, SHOWN).map((p) => (
          <PickItem key={p.id} pair={p} chosen={selected.includes(p.id)} onPut={onPut} />
        ))}
        {!hits.length ? <li className="px-1 py-2 text-xs text-muted">No pairs match that search.</li> : null}
      </ul>
      {hits.length > SHOWN ? <p className="mt-1 text-xs text-muted">Showing {SHOWN} of {hits.length}. Search to narrow it down.</p> : null}
    </Card>
  );
}

function PickItem({ pair, chosen, onPut }: { pair: ExplorePair; chosen: boolean; onPut: (slot: Slot, id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `pick:${pair.id}` });
  const label = pairText(pair);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('flex items-center gap-1 rounded-lg border bg-surface px-1 py-1', chosen ? 'border-accent' : 'border-border', isDragging && 'relative z-20 shadow-lg')}
    >
      <button {...attributes} {...listeners} className="flex min-h-9 min-w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-2" aria-label={`Drag: ${label}`}>
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">{pair.rank ? `#${pair.rank}` : '–'}</span>
      <div className="min-w-0 flex-1" title={label}>
        {pair.sides.map((s, k) => (
          <p key={k} className="truncate text-xs font-medium">{s?.short ?? 'No Match'}</p>
        ))}
      </div>
      <button onClick={() => onPut('a', pair.id)} className="min-h-9 rounded-md px-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text" aria-label={`Put in This: ${label}`}>This</button>
      <button onClick={() => onPut('b', pair.id)} className="min-h-9 rounded-md px-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text" aria-label={`Put in That: ${label}`}>That</button>
    </li>
  );
}

function SlotCard({ slot, label, pair, names, onClear }: { slot: Slot; label: string; pair?: ExplorePair; names: [string, string]; onClear: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` });
  return (
    <div
      ref={setNodeRef}
      data-testid={`slot-${slot}`}
      className={cn('flex min-h-40 flex-col gap-2 rounded-2xl border-2 border-dashed p-4', isOver ? 'border-accent bg-accent-soft' : pair ? 'border-border border-solid bg-surface' : 'border-border')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}{pair?.rank ? ` · #${pair.rank}` : pair ? ' · not on your list' : ''}</span>
        {pair ? (
          <button onClick={onClear} className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2" aria-label={`Clear ${label}`}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {pair ? (
        <>
          {pair.sides.map((s, k) => (
            <div key={k} className={cn('border-l-4 pl-3', k === 0 ? 'border-partner-1' : 'border-partner-2')}>
              <p className={cn('text-xs font-semibold', k === 0 ? 'text-partner-1' : 'text-partner-2')}>{names[k]}</p>
              <p className="text-sm font-medium leading-snug" title={s?.name}>{s?.short ?? 'No Match'}</p>
              {s?.place ? <p className="text-xs text-muted">{s.place}</p> : null}
            </div>
          ))}
          <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} />
        </>
      ) : (
        <p className="m-auto text-sm text-muted">Drop a pair here</p>
      )}
    </div>
  );
}

function Detail({ d, onChoose, busy }: { d: ExploreDetail; onChoose: (impact: Impact, strong: boolean) => void; busy: boolean }) {
  const [hi, lo] = d.higher === 'a' ? [d.a, d.b] : [d.b, d.a];
  const where = (p: ExplorePair) => (p.rank ? `#${p.rank}` : 'off the list');
  const answered = d.answer ? (d.answer.winner === 'tie' ? 'You said these are too close to call.' : `You answered: ${pairText(d.answer.winner === 'a' ? d.a : d.b)}.`) : null;
  const modelSide = d.model.prefers === 'a' ? d.a : d.b;
  return (
    <div className="flex flex-col gap-4" data-testid="explore-detail">
      <Card className="p-4 sm:p-4">
        <p className="font-medium">
          {pairText(hi)} <span className="text-muted">({where(hi)})</span> is above {pairText(lo)} <span className="text-muted">({where(lo)})</span>.
        </p>
        <p className="mt-1 text-sm">{d.why}</p>
        <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted">
          <li className="flex gap-2">
            {d.fixed ? <Lock className="h-4 w-4 shrink-0" aria-hidden /> : <Info className="h-4 w-4 shrink-0" aria-hidden />}
            {d.fixed ? 'Set by a rule or something you told us, not just the score.' : 'Set by the score: an answer can change it without any conflict.'}
          </li>
          {answered ? (
            <li className="flex gap-2">
              <Info className="h-4 w-4 shrink-0" aria-hidden /> {answered}
              {d.answer?.locked ? ' (locked)' : ''}
            </li>
          ) : null}
          <li className="flex gap-2">
            <Info className="h-4 w-4 shrink-0" aria-hidden /> The model’s guess: {pairText(modelSide)} ({Math.round(d.model.p * 100)}%).
          </li>
        </ul>
        {d.moot ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">{d.moot}</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <ImpactCard title="This above that" impact={d.aOverB} over={d.a} under={d.b} onChoose={onChoose} busy={busy} />
        <ImpactCard title="That above this" impact={d.bOverA} over={d.b} under={d.a} onChoose={onChoose} busy={busy} />
      </div>
    </div>
  );
}

function ImpactCard({ title, impact, over, under, onChoose, busy }: { title: string; impact: Impact; over: ExplorePair; under: ExplorePair; onChoose: (impact: Impact, strong: boolean) => void; busy: boolean }) {
  const [strong, setStrong] = useState(false);
  return (
    <Card className={cn('flex flex-col gap-2 p-4 sm:p-4', impact.conflicts.length && 'border-warn')} data-testid={impact.asNow ? 'impact-keep' : 'impact-flip'}>
      <h3 className="font-semibold">{title}{impact.asNow ? <span className="ml-2 text-xs font-normal text-muted">as your list has it now</span> : null}</h3>
      <p className="text-sm">
        <span className="font-medium">{pairText(over)}</span> <span className="text-muted">above</span> {pairText(under)}
      </p>
      <p className="text-xs text-muted">{impact.moved ? `Answering this way moves ${impact.moved} row${impact.moved === 1 ? '' : 's'}:` : 'Answering this way moves no rows.'}</p>
      {impact.moves.length ? (
        <ul className="flex flex-col gap-0.5 text-xs">
          {impact.moves.map((m) => (
            <li key={m.pairId} className="flex gap-2">
              <span className="w-20 shrink-0 tabular-nums text-muted">{m.from ? `#${m.from}` : 'off'} → {m.to ? `#${m.to}` : 'off'}</span>
              <span className="min-w-0 truncate" title={m.label}>{m.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {impact.conflicts.length ? (
        <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn" role="note">
          <p className="flex items-center gap-1.5 font-medium"><CircleAlert className="h-4 w-4" aria-hidden /> This would clash with what you’ve said:</p>
          <ul className="mt-1 list-disc pl-5">
            {impact.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-1">You can still answer; you’ll choose what gives way on the Conflicts step.</p>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
        <label className="flex min-h-9 items-center gap-2 text-xs">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={strong} onChange={(e) => setStrong(e.target.checked)} />
          Strong preference (locks it)
        </label>
        <Button size="sm" disabled={busy} onClick={() => onChoose(impact, strong)}>
          {impact.asNow ? 'Confirm this order' : 'Flip to this order'}
        </Button>
      </div>
    </Card>
  );
}
