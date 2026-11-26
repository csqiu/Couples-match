'use client';
import type { ComparisonRow, CoupleData } from '@pairwise/db';
import { ArrowDownUp, ArrowUp, CircleAlert, Flag, Info, Lock } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { MiniMap } from '@/components/mini-map';
import { PairChip , WhyText } from '@/components/pair';
import { BandBadge } from '@/components/proximity';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import type { ExploreDetail, ExplorePair, Impact } from '@/lib/explore';
import { pairIdOf, pickFromPairId, rankLists, specificState, type Picks } from '@/lib/specific';
import { useExplore } from '@/lib/use-analysis';
import { answer } from './actions';
import { ProgramPlate } from './program-plate';

type LocalRow = Pick<ComparisonRow, 'id' | 'pair_left' | 'pair_right' | 'winner' | 'answered_by' | 'both_agreed' | 'locked' | 'seq'>;

/**
 * "Make a specific comparison": pick a program for each partner on each side, see
 * which pair the list puts higher and why, and keep, swap or call it a tie. Each
 * choice is saved as a this-or-that answer.
 */
export function SpecificComparison({
  data,
  me,
  names,
  answerMode,
  hideTierOf,
  initialA,
  initialB = null,
}: {
  data: CoupleData;
  me: string;
  names: [string, string];
  answerMode: 'together' | 'separately';
  hideTierOf: 0 | 1 | null;
  /** A pair to start "This" with (from the final list). */
  initialA: string | null;
  /** A pair to start "That" with. */
  initialB?: string | null;
}) {
  const [picks, setPicks] = useState<[Picks, Picks]>(() => [pickFromPairId(initialA), pickFromPairId(initialB)]);
  const [local, setLocal] = useState<LocalRow[]>([]);
  const [flag, setFlag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, start] = useTransition();
  const toast = useToast();

  const state = specificState(picks[0], picks[1]);
  const merged = useMemo<CoupleData>(() => {
    const ids = new Set(data.comparisons.map((c) => c.id));
    return { ...data, comparisons: [...data.comparisons, ...local.filter((l) => !ids.has(l.id))] };
  }, [data, local]);
  const a = state.kind === 'ready' ? state.a : null;
  const b = state.kind === 'ready' ? state.b : null;
  const opts = useMemo(() => ({ me, names, a, b }), [me, names, a, b]);
  const { result, busy, error } = useExplore(merged, opts);
  const lists = useMemo(() => (result ? rankLists(result.pairs) : [[], []]), [result]);
  const pairsById = useMemo(() => new Map((result?.pairs ?? []).map((p) => [p.id, p])), [result]);

  if (error) return <p className="text-danger" role="alert">Something went wrong: {error}</p>;
  if (!result) return <div className="glass h-96 animate-pulse" aria-label="Loading" />;

  const d = result.detail;
  const tied = d?.answer?.winner === 'tie';
  const setPick = (card: 0 | 1, side: 0 | 1, id: string) =>
    setPicks((p) => {
      const next: [Picks, Picks] = [[...p[0]], [...p[1]]];
      next[card][side] = id;
      return next;
    });

  function save(left: string, right: string, winner: 'left' | 'tie', message: string) {
    const row: LocalRow = {
      id: `local-${Date.now()}`,
      pair_left: left,
      pair_right: right,
      winner,
      answered_by: me,
      both_agreed: answerMode === 'together',
      locked: false,
      seq: Number.MAX_SAFE_INTEGER - 1000 + local.length,
    };
    setLocal((xs) => [...xs, row]);
    setSaving(true);
    start(async () => {
      const res = await answer({ left, right, winner, flag });
      setSaving(false);
      if (res.error && !res.id) {
        setLocal((xs) => xs.filter((x) => x.id !== row.id));
        toast({ message: `Couldn’t save that answer: ${res.error}` });
        return;
      }
      setLocal((xs) => xs.map((x) => (x.id === row.id ? { ...x, id: res.id! } : x)));
      toast({ message: flag ? `${message} Flagged to discuss together.` : message });
    });
  }

  const remaining =
    state.kind === 'choosing'
      ? state.missing === 4
        ? 'Click a plate to choose a program from that person’s rank list.'
        : `Choose ${state.missing} more to see how your list orders these two pairs.`
      : state.kind === 'both-no-match'
        ? 'A pair needs a program for at least one of you.'
        : state.kind === 'same'
          ? 'Those are the same pair. Change one of the programs.'
          : null;

  return (
    <section aria-label="Specific comparison" className={cn('flex flex-col gap-4', busy && 'opacity-80')} data-testid="specific">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        {([0, 1] as const).map((card) => {
          const pick = picks[card];
          const id = pairIdOf(pick);
          const pair = id ? pairsById.get(id) : undefined;
          const key = card === 0 ? 'a' : 'b';
          const isHi = !!d && !tied && d.higher === key;
          const isLo = !!d && !tied && d.higher !== key;
          const sides = pick.map((p, s) => lists[s].find((x) => x.id === p) ?? null);
          const points = sides.flatMap((s) => (s && s.lat != null && s.lon != null ? [{ lat: s.lat, lon: s.lon }] : []));
          const cardEl = (
            <div
              key={card}
              className={cn(
                'glass glass-strong relative flex min-w-0 flex-col focus-within:z-20',
                isHi && 'border-[3px] border-action shadow-glass',
                isLo && 'opacity-85',
              )}
              data-testid={`specific-${key}`}
              data-higher={isHi || undefined}
            >
              <div className="relative overflow-hidden rounded-t-[22px]">
                {points.length ? (
                  <MiniMap points={points} className="h-32 w-full bg-surface-2 sm:h-36" label={`Map: ${sides.map((s) => s?.place ?? 'No Match').join(' and ')}`} />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-surface-2 text-[13px] text-muted sm:h-36">The map fills in as you choose</div>
                )}
                <span className="eyebrow absolute top-2.5 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-muted">{card === 0 ? 'This' : 'That'}</span>
                {isHi ? (
                  <span className="absolute top-2.5 right-3 inline-flex items-center gap-1.5 rounded-full bg-action px-2.5 py-1 text-xs font-semibold text-action-fg">
                    <ArrowUp className="h-3 w-3" aria-hidden /> Higher on your list
                  </span>
                ) : null}
                {pair ? (
                  <span className="absolute right-3 bottom-2.5 rounded-full bg-surface/90 px-2.5 py-0.5 font-mono text-xs">
                    {pair.rank ? `#${pair.rank} on your list` : 'Not on your list'}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
                <ProgramPlate name={names[0]} slot={1} programs={lists[0]} value={pick[0]} onChange={(v) => setPick(card, 0, v)} showTiers={hideTierOf !== 0} />
                <div className="flex min-h-7 items-center gap-2 pl-5">
                  <span className="h-6 border-l-2 border-dashed border-border" aria-hidden />
                  {pair ? (
                    <BandBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} />
                  ) : (
                    <span className="text-[12.5px] text-muted">Choose both programs to see the distance</span>
                  )}
                </div>
                <ProgramPlate name={names[1]} slot={2} programs={lists[1]} value={pick[1]} onChange={(v) => setPick(card, 1, v)} showTiers={hideTierOf !== 1} />
              </div>
            </div>
          );
          return card === 0 ? (
            [
              cardEl,
              <div key="or" className="flex items-center justify-center">
                <span className="glass glass-strong flex h-[52px] w-[52px] items-center justify-center rounded-full font-display text-base font-semibold text-muted">or</span>
              </div>,
            ]
          ) : (
            cardEl
          );
        })}
      </div>

      {remaining ? <p className="rounded-[20px] border-2 border-dashed border-border p-4 text-center text-sm text-muted">{remaining}</p> : null}

      {d ? (
        <Outcome
          d={d}
          names={names}
          tied={tied}
          flag={flag}
          onFlag={setFlag}
          busy={busy || saving}
          onClear={() => setPicks([[null, null], [null, null]])}
          onKeep={(i) => save(i.higher, i.lower, 'left', 'Saved as your answer: this order now holds.')}
          onSwap={(i) => save(i.higher, i.lower, 'left', 'Swapped and saved as your answer.')}
          onTie={() => save(d.a.id, d.b.id, 'tie', 'Saved: too close to call.')}
        />
      ) : null}
    </section>
  );
}

function Outcome({
  d,
  names,
  tied,
  flag,
  onFlag,
  busy,
  onClear,
  onKeep,
  onSwap,
  onTie,
}: {
  d: ExploreDetail;
  names: [string, string];
  tied: boolean;
  flag: boolean;
  onFlag: (on: boolean) => void;
  busy: boolean;
  onClear: () => void;
  onKeep: (impact: Impact) => void;
  onSwap: (impact: Impact) => void;
  onTie: () => void;
}) {
  const [hi, lo] = d.higher === 'a' ? [d.a, d.b] : [d.b, d.a];
  const keep = d.aOverB.asNow ? d.aOverB : d.bOverA;
  const swap = d.aOverB.asNow ? d.bOverA : d.aOverB;
  const where = (p: ExplorePair) => (p.rank ? `#${p.rank}` : 'off the list');
  const answered = d.answer
    ? d.answer.winner === 'tie'
      ? 'You said these are too close to call.'
      : 'This order is your answer.'
    : null;
  return (
    <div className="glass glass-strong flex flex-col gap-3 p-5" data-testid="specific-outcome">
      <p className="font-medium">
        <PairChip pair={hi} names={names} /> <span className="text-muted">({where(hi)})</span> is above <PairChip pair={lo} names={names} />{' '}
        <span className="text-muted">({where(lo)})</span> on your list.
      </p>
      <p className="text-sm"><WhyText parts={d.whyParts} names={names} fallback={d.why} /></p>
      <ul className="flex flex-col gap-1.5 text-xs text-muted">
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
      </ul>
      {d.moot ? <p className="rounded-[12px] bg-surface-2 px-3 py-2 text-xs">{d.moot}</p> : null}
      {swap.conflicts.length ? (
        <div className="rounded-[14px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn" role="note">
          <p className="flex items-center gap-1.5 font-medium"><CircleAlert className="h-4 w-4" aria-hidden /> Swapping would clash with what you’ve said:</p>
          <ul className="mt-1 list-disc pl-5">
            {swap.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-1">You can still swap; you’ll choose what gives way on the Conflicts step.</p>
        </div>
      ) : (
        <p className="rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[13px]">
          {swap.moved ? `Swapping moves ${swap.moved} row${swap.moved === 1 ? '' : 's'} on your final list.` : 'Swapping moves no rows on your final list.'} No conflicts.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--action)]" checked={flag} onChange={(e) => onFlag(e.target.checked)} />
          <Flag className="h-4 w-4 text-warn" aria-hidden /> Flag to discuss together
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onClear}>Clear</Button>
          <Button variant="secondary" disabled={busy || tied} onClick={onTie}>Too close to call</Button>
          <Button variant="secondary" disabled={busy || (!!d.answer && !tied)} onClick={() => onKeep(keep)}>Keep this order</Button>
          <Button disabled={busy} onClick={() => onSwap(swap)}>
            <ArrowDownUp className="h-4 w-4" aria-hidden /> Swap order
          </Button>
        </div>
      </div>
    </div>
  );
}
