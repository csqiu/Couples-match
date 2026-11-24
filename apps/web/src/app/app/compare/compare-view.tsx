'use client';
import type { ComparisonRow, CoupleData } from '@pairwise/db';
import { Check, ChevronsUp, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { MiniMap } from '@/components/mini-map';
import { BandBadge as ProximityBadge } from '@/components/proximity';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { PairView, QuestionView } from '@/lib/analysis';
import { cn } from '@/lib/cn';
import { useAnalysis } from '@/lib/use-analysis';
import { answer, undoAnswer } from './actions';

type LocalAnswer = { tempId: string; realId?: string; row: Pick<ComparisonRow, 'id' | 'pair_left' | 'pair_right' | 'winner' | 'answered_by' | 'both_agreed' | 'locked' | 'seq'> };

export function BandBadge({ pair }: { pair: PairView }) {
  return <ProximityBadge band={pair.band} bandLabel={pair.bandLabel} distanceMi={pair.distanceMi} />;
}

export function PairCard({
  pair,
  names,
  hideTierOf,
  action,
  highlight,
}: {
  pair: PairView;
  names: [string, string];
  /** Index (0 = partner A, 1 = partner B) whose tier is private to me, if any. */
  hideTierOf: 0 | 1 | null;
  action?: React.ReactNode;
  highlight?: boolean;
}) {
  const points = pair.sides.flatMap((s) => (s && s.lat != null && s.lon != null ? [{ lat: s.lat, lon: s.lon }] : []));
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border bg-surface', highlight ? 'border-accent' : 'border-border')}>
      <MiniMap
        points={points}
        className="h-36 w-full bg-surface-2 sm:h-44"
        label={`Map: ${pair.sides.map((s) => s?.place ?? 'No Match').join(' and ')}`}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <BandBadge pair={pair} />
        {pair.sides.map((side, k) => (
          <div key={k} className={cn('border-l-4 pl-3', k === 0 ? 'border-partner-1' : 'border-partner-2')}>
            <p className={cn('text-base font-semibold', k === 0 ? 'text-partner-1' : 'text-partner-2')}>{names[k]}</p>
            {side ? (
              <>
                <p className="font-medium leading-snug" title={side.name}>{side.short}</p>
                {side.short !== side.name ? <p className="text-xs leading-snug text-muted">{side.name}</p> : null}
                <p className="flex items-center gap-2 text-sm text-muted">
                  {side.place}
                  {side.tier && hideTierOf !== k ? <Badge tone={side.tier}>Tier {side.tier}</Badge> : null}
                </p>
              </>
            ) : (
              <p className="font-medium text-warn">No Match</p>
            )}
          </div>
        ))}
        {action ? <div className="mt-auto pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function CompareView({
  data,
  me,
  names,
  role,
  answerMode,
  privateTiers,
}: {
  data: CoupleData;
  me: string;
  names: [string, string];
  role: 'a' | 'b';
  answerMode: 'together' | 'separately';
  privateTiers: boolean;
}) {
  const [local, setLocal] = useState<LocalAnswer[]>([]);
  const [saving, setSaving] = useState(0);
  const [, startSave] = useTransition();
  const toast = useToast();

  // Server rows plus my answers that haven't come back from the server yet.
  const merged = useMemo<CoupleData>(() => {
    const serverIds = new Set(data.comparisons.map((c) => c.id));
    const extra = local.filter((l) => !(l.realId && serverIds.has(l.realId))).map((l) => l.row);
    return { ...data, comparisons: [...data.comparisons, ...extra] };
  }, [data, local]);

  const opts = useMemo(() => ({ me, names, answerMode }), [me, names, answerMode]);
  const { result, busy, error } = useAnalysis(merged, opts);
  const hideTierOf = privateTiers ? (role === 'a' ? 1 : 0) : null;
  const partnerName = role === 'a' ? names[1] : names[0];

  /** `strong`: "Strong preference for this pair" — saved as a locked answer (a pin the list can't override). */
  function choose(q: QuestionView, winner: 'left' | 'right' | 'tie', strong = false) {
    const certain = strong && winner !== 'tie';
    const tempId = `local-${Date.now()}`;
    const row: LocalAnswer['row'] = {
      id: tempId,
      pair_left: q.left.id,
      pair_right: q.right.id,
      winner,
      answered_by: me,
      both_agreed: answerMode === 'together',
      locked: certain,
      seq: Number.MAX_SAFE_INTEGER - 1000 + local.length,
    };
    setLocal((xs) => [...xs, { tempId, row }]);
    const wasCertain = certain;
    setSaving((n) => n + 1);
    startSave(async () => {
      const res = await answer({ left: q.left.id, right: q.right.id, winner, certain: wasCertain }).finally(() =>
        setSaving((n) => n - 1),
      );
      if (res.error && !res.id) {
        setLocal((xs) => xs.filter((x) => x.tempId !== tempId));
        toast({ message: `Couldn’t save that answer: ${res.error}` });
        return;
      }
      setLocal((xs) => xs.map((x) => (x.tempId === tempId ? { ...x, realId: res.id, row: { ...x.row, id: res.id! } } : x)));
    });
  }

  const lastMine = [...local].reverse().find((l) => l.realId);

  if (!result) {
    return <div className="h-96 animate-pulse rounded-2xl bg-surface-2" aria-label="Loading" />;
  }
  if (error) return <p className="text-danger" role="alert">Something went wrong: {error}</p>;

  if (!result.hasBothLists) {
    return (
      <Empty title={`Waiting for ${partnerName}`} body={`Comparisons need both lists. Once ${partnerName} has added and ranked programs, you can start.`}>
        <Link href="/app/rank" className={buttonVariants({ variant: 'secondary' })}>Back to my ranking</Link>
      </Empty>
    );
  }

  const q = result.question;
  const pct = Math.round(result.confidence * 100);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">This or that</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Which pair would you rather match into? There are no wrong answers — this teaches the app how much distance
            matters to you{answerMode === 'together' ? ' as a couple' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/conflicts" className={buttonVariants({ variant: 'secondary' })}>
            Conflicts{result.conflicts.length ? ` (${result.conflicts.length})` : ''}
          </Link>
          <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Final list</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">List confidence</span>
          <span className="tabular-nums text-muted" data-testid="confidence">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="List confidence">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {result.answered} answer{result.answered === 1 ? '' : 's'} so far.
          {result.done
            ? ' Your list is in good shape — you can stop here or keep going.'
            : ' Your full list is ready on the Final list step at any time; more answers just sharpen it.'}
          {local.length ? (
            <span className="ml-1" aria-live="polite" data-testid="save-status">
              {saving > 0 ? 'Saving…' : 'All answers saved.'}
            </span>
          ) : null}
        </p>
      </div>

      {q ? (
        <section aria-label="Question" className={cn('flex flex-col gap-4 transition-opacity', busy && 'opacity-60')}>
          {q.kind === 'partner' ? (
            <p className="rounded-xl bg-accent-soft px-4 py-2 text-sm text-accent">{partnerName} answered this one — what’s your take? (You’ll see if you differ.)</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <PairCard pair={q.left} names={names} hideTierOf={hideTierOf} action={<ChoiceButtons disabled={busy} onChoose={(strong) => choose(q, 'left', strong)} />} />
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium text-muted">or</span>
            </div>
            <PairCard pair={q.right} names={names} hideTierOf={hideTierOf} action={<ChoiceButtons disabled={busy} onChoose={(strong) => choose(q, 'right', strong)} />} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              <strong className="font-semibold text-text">Strong preference</strong> locks this order: nothing later can put the other pair above it.
            </p>
            <div className="flex gap-2">
              {lastMine ? (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    setLocal((xs) => xs.filter((x) => x !== lastMine));
                    const res = await undoAnswer(lastMine.realId!);
                    if (res.error) toast({ message: res.error });
                  }}
                >
                  <Undo2 className="h-4 w-4" aria-hidden /> Undo last
                </Button>
              ) : null}
              <Button variant="secondary" disabled={busy} onClick={() => choose(q, 'tie')}>Too close to call</Button>
            </div>
          </div>
        </section>
      ) : (
        <Empty title="No more questions for now" body="Your answers and the rules already order your list. Check for conflicts, then review the final list.">
          <Link href="/app/conflicts" className={buttonVariants()}>Check conflicts</Link>
        </Empty>
      )}
    </div>
  );
}

/** Two answers per card: a plain choice, and a strong one that locks the order (bug log #8). */
function ChoiceButtons({ disabled, onChoose }: { disabled: boolean; onChoose: (strong: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Button className="w-full" disabled={disabled} onClick={() => onChoose(false)}>
        <Check className="h-4 w-4" aria-hidden /> Choose this pair
      </Button>
      <Button
        variant="secondary"
        className="w-full border-2 border-accent font-semibold text-accent hover:bg-accent-soft"
        disabled={disabled}
        onClick={() => onChoose(true)}
      >
        <ChevronsUp className="h-4 w-4" aria-hidden /> Strong preference for this pair
      </Button>
    </div>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}
