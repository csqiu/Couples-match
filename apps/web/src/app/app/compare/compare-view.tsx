'use client';
import type { ComparisonRow, CoupleData, StoredSettings } from '@pairwise/db';
import { questionKey } from '@pairwise/engine';
import { Check, Clock, Compass, Flag, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/avatar';
import { MiniMap } from '@/components/mini-map';
import { BandBadge as ProximityBadge } from '@/components/proximity';
import { TierBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { FlaggedView, PairView, QuestionView } from '@/lib/analysis';
import { cn } from '@/lib/cn';
import { useAnalysis } from '@/lib/use-analysis';
import { answer, deferQuestion, setQuestionFlag, undoAnswer } from './actions';

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
    <div className={cn('glass glass-strong flex flex-col overflow-hidden', highlight && 'ring-2 ring-action/40')}>
      <MiniMap
        points={points}
        className="h-36 w-full bg-surface-2 sm:h-44"
        label={`Map: ${pair.sides.map((s) => s?.place ?? 'No Match').join(' and ')}`}
      />
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        {pair.sides.map((side, k) => (
          <div key={k} className="flex flex-col gap-2">
            {k === 1 ? (
              <div className="flex items-center gap-2 pl-3">
                <span className="h-6 border-l-2 border-dashed border-border" aria-hidden />
                <BandBadge pair={pair} />
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <Avatar name={names[k]} slot={k === 0 ? 1 : 2} className="mt-0.5" />
              <div className="min-w-0">
                <p className="eyebrow text-muted">{names[k]}</p>
                {side ? (
                  <>
                    <p className="mt-1 flex items-center gap-2 font-display text-lg leading-snug font-semibold" title={side.name}>
                      {side.tier && hideTierOf !== k ? <TierBadge tier={side.tier} /> : null}
                      {side.short}
                    </p>
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
  // Saved-for-later and flag changes, shown at once (the server copy catches up on revalidate).
  const [localDeferred, setLocalDeferred] = useState<string[]>([]);
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(0);
  const [, startSave] = useTransition();
  const toast = useToast();

  // Server rows plus my answers that haven't come back from the server yet.
  const merged = useMemo<CoupleData>(() => {
    const serverIds = new Set(data.comparisons.map((c) => c.id));
    const extra = local.filter((l) => !(l.realId && serverIds.has(l.realId))).map((l) => l.row);
    const stored = (data.couple.settings ?? {}) as StoredSettings;
    const flagged = new Set(stored.flaggedQuestions ?? []);
    for (const [k, on] of Object.entries(localFlags)) {
      if (on) flagged.add(k);
      else flagged.delete(k);
    }
    const settings: StoredSettings = {
      ...stored,
      deferredQuestions: [...new Set([...(stored.deferredQuestions ?? []), ...localDeferred])],
      flaggedQuestions: [...flagged],
    };
    return { ...data, couple: { ...data.couple, settings: settings as never }, comparisons: [...data.comparisons, ...extra] };
  }, [data, local, localDeferred, localFlags]);

  function flagLocally(left: string, right: string, on: boolean) {
    setLocalFlags((f) => ({ ...f, [questionKey(left, right)]: on }));
  }

  /** "Come back to this later": skip it now; it returns once the other questions run out. */
  function later(q: QuestionView, flag: boolean) {
    const key = questionKey(q.left.id, q.right.id);
    setLocalDeferred((xs) => [...xs, key]);
    flagLocally(q.left.id, q.right.id, flag);
    startSave(async () => {
      const res = await deferQuestion(q.left.id, q.right.id, flag);
      if (res.error) {
        setLocalDeferred((xs) => xs.filter((x) => x !== key));
        toast({ message: `Couldn’t save that: ${res.error}` });
      } else toast({ message: flag ? 'Saved for later and flagged.' : 'Saved for later. We’ll come back to it.' });
    });
  }

  async function unflag(f: FlaggedView) {
    flagLocally(f.left.id, f.right.id, false);
    const res = await setQuestionFlag(f.left.id, f.right.id, false);
    if (res.error) {
      flagLocally(f.left.id, f.right.id, true);
      toast({ message: `Couldn’t unflag: ${res.error}` });
    }
  }

  const opts = useMemo(() => ({ me, names, answerMode }), [me, names, answerMode]);
  const { result, busy, error } = useAnalysis(merged, opts);
  const hideTierOf = privateTiers ? (role === 'a' ? 1 : 0) : null;
  const partnerName = role === 'a' ? names[1] : names[0];

  /** Every answer holds in the list (a rule); a clash with another rule goes to Conflicts. */
  function choose(q: QuestionView, winner: 'left' | 'right' | 'tie', flag = q.flagged) {
    if (flag !== q.flagged) flagLocally(q.left.id, q.right.id, flag);
    const tempId = `local-${Date.now()}`;
    const row: LocalAnswer['row'] = {
      id: tempId,
      pair_left: q.left.id,
      pair_right: q.right.id,
      winner,
      answered_by: me,
      both_agreed: answerMode === 'together',
      locked: false,
      seq: Number.MAX_SAFE_INTEGER - 1000 + local.length,
    };
    setLocal((xs) => [...xs, { tempId, row }]);
    setSaving((n) => n + 1);
    startSave(async () => {
      const res = await answer({ left: q.left.id, right: q.right.id, winner, flag }).finally(() =>
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
    return <div className="glass h-96 animate-pulse" aria-label="Loading" />;
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
          <h1 className="page-title">This or that</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Which pair would you rather match into? There are no wrong answers — this teaches the app how much distance
            matters to you{answerMode === 'together' ? ' as a couple' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/explore" className={buttonVariants({ variant: 'secondary' })}>
            <Compass className="h-4 w-4" aria-hidden /> Explore
          </Link>
          <Link href="/app/conflicts" className={buttonVariants({ variant: 'secondary' })}>
            Conflicts{result.conflicts.length ? ` (${result.conflicts.length})` : ''}
          </Link>
          <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Final list</Link>
        </div>
      </div>

      <div className="glass p-4 sm:p-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">List confidence</span>
          <span className="font-mono tabular-nums text-muted" data-testid="confidence">{pct}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-text/8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="List confidence">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--partner-1),var(--partner-2))] transition-[width] duration-500" style={{ width: `${pct}%` }} />
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
        <QuestionBlock
          key={`${q.left.id}#${q.right.id}`}
          q={q}
          names={names}
          hideTierOf={hideTierOf}
          partnerName={partnerName}
          busy={busy}
          onChoose={(winner, flag) => choose(q, winner, flag)}
          onLater={(flag) => later(q, flag)}
          undo={
            lastMine ? (
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
            ) : null
          }
        />
      ) : (
        <Empty title="No more questions for now" body="Your answers and the rules already order your list. Check for conflicts, then review the final list.">
          <Link href="/app/conflicts" className={buttonVariants()}>Check conflicts</Link>
        </Empty>
      )}

      {result.flagged.length ? <FlaggedList items={result.flagged} names={names} onUnflag={(f) => void unflag(f)} /> : null}
    </div>
  );
}

function QuestionBlock({
  q,
  names,
  hideTierOf,
  partnerName,
  busy,
  onChoose,
  onLater,
  undo,
}: {
  q: QuestionView;
  names: [string, string];
  hideTierOf: 0 | 1 | null;
  partnerName: string;
  busy: boolean;
  onChoose: (winner: 'left' | 'right' | 'tie', flag: boolean) => void;
  onLater: (flag: boolean) => void;
  undo: React.ReactNode;
}) {
  // Keyed by question, so the box starts as the question's current flag.
  const [flag, setFlag] = useState(q.flagged);
  return (
    <section aria-label="Question" className={cn('flex flex-col gap-4 transition-opacity', busy && 'opacity-60')}>
      {q.kind === 'partner' ? (
        <p className="rounded-2xl border border-glass-border bg-accent-soft/80 px-4 py-3 text-sm text-accent">{partnerName} answered this one — what’s your take? (You’ll see if you differ.)</p>
      ) : null}
      {q.kind === 'later' ? (
        <p className="rounded-2xl border border-glass-border bg-glass-strong px-4 py-3 text-sm">You saved this one for later. Ready to answer it?</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <PairCard pair={q.left} names={names} hideTierOf={hideTierOf} action={<ChoiceButton disabled={busy} onChoose={() => onChoose('left', flag)} />} />
        <div className="flex items-center justify-center">
          <span className="glass glass-strong flex h-[52px] w-[52px] items-center justify-center rounded-full font-display text-base font-semibold text-muted">or</span>
        </div>
        <PairCard pair={q.right} names={names} hideTierOf={hideTierOf} action={<ChoiceButton disabled={busy} onChoose={() => onChoose('right', flag)} />} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--action)]" checked={flag} onChange={(e) => setFlag(e.target.checked)} data-testid="flag" />
          <Flag className="h-4 w-4 text-warn" aria-hidden /> Flag to discuss together
        </label>
        <div className="flex flex-wrap gap-2">
          {undo}
          <Button variant="secondary" disabled={busy} onClick={() => onLater(flag)}>
            <Clock className="h-4 w-4" aria-hidden /> Come back to this later
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => onChoose('tie', flag)}>Too close to call</Button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Every answer holds in your list. If one ever clashes with a rule or another answer, we’ll show you both and you choose.
      </p>
    </section>
  );
}

function pairText(p: PairView) {
  return p.sides.map((s) => s?.short ?? 'No Match').join(' + ');
}

/** Questions flagged to discuss, with where each one stands. */
function FlaggedList({ items, names, onUnflag }: { items: FlaggedView[]; names: [string, string]; onUnflag: (f: FlaggedView) => void }) {
  const status = (f: FlaggedView) =>
    f.answer === 'left' ? `You chose ${pairText(f.left)}.` : f.answer === 'right' ? `You chose ${pairText(f.right)}.` : f.answer === 'tie' ? 'Too close to call.' : f.deferred ? 'Saved for later.' : 'Not answered yet.';
  return (
    <section aria-labelledby="flagged-title" className="glass p-4 sm:p-5" data-testid="flagged">
      <h2 id="flagged-title" className="card-title flex items-center gap-2">
        <Flag className="h-4 w-4 text-warn" aria-hidden /> Flagged to discuss ({items.length})
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((f) => (
          <li key={f.key} className="glass-row flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
            <div className="min-w-0 text-sm">
              <p className="truncate" title={`${names[0]} + ${names[1]}`}>
                {pairText(f.left)} <span className="text-muted">or</span> {pairText(f.right)}
              </p>
              <p className="text-xs text-muted">{status(f)}</p>
            </div>
            <div className="flex gap-1">
              <Link href={`/app/explore?a=${encodeURIComponent(f.left.id)}&b=${encodeURIComponent(f.right.id)}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                <Compass className="h-4 w-4" aria-hidden /> Explore
              </Link>
              <Button variant="ghost" size="sm" onClick={() => onUnflag(f)}>Unflag</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChoiceButton({ disabled, onChoose }: { disabled: boolean; onChoose: () => void }) {
  return (
    <Button className="w-full" disabled={disabled} onClick={onChoose}>
      <Check className="h-4 w-4" aria-hidden /> Choose this pair
    </Button>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-3 border-dashed p-10 text-center">
      <p className="card-title">{title}</p>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}
