'use client';
import type { CoupleData } from '@pairwise/db';
import { ArrowRight, CircleCheck, Link2Off } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import type { ConflictView } from '@/lib/analysis';
import { cn } from '@/lib/cn';
import { useAnalysis } from '@/lib/use-analysis';
import { PairLarge, PairTile, PickedTag } from '@/components/pair';
import { breakLink, confirmAnswer, flipAnswer, removeAnswer, resolveDisagreement } from './actions';

const TITLES: Record<ConflictView['kind'], string> = {
  cycle: 'These answers go in a circle',
  surprising_answer: 'Still true?',
  disagreement: 'You answered differently',
};

export function ConflictsView({
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
  const opts = useMemo(() => ({ me, names, answerMode }), [me, names, answerMode]);
  const { result, busy } = useAnalysis(data, opts);
  // Arriving from a move that clashes (final list): that conflict first, and marked.
  const focus = useSearchParams().get('pair');
  const involves = (c: ConflictView) =>
    !!focus && (c.links?.some((l) => l.from === focus || l.to === focus) || c.left?.id === focus || c.right?.id === focus);
  const conflicts = useMemo(() => {
    const list = result?.conflicts ?? [];
    return [...list.filter(involves), ...list.filter((c) => !involves(c))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, focus]);
  const [pending, setPending] = useState<string | null>(null);
  const toast = useToast();
  const hideTierOf = privateTiers ? (role === 'a' ? 1 : 0) : null;
  const myName = role === 'a' ? names[0] : names[1];
  const partnerName = role === 'a' ? names[1] : names[0];
  const mySlot = role === 'a' ? 0 : 1;
  const partnerSlot = role === 'a' ? 1 : 0;
  /** Who picked this side, as partner-coloured tags (both, if you both did). */
  const pickedBy = (answers: ConflictView['answers'], side: 'left' | 'right') => {
    const who = (answers ?? []).filter((a) => a.winner === side);
    if (!who.length) return undefined;
    return (
      <span className="flex flex-wrap justify-end gap-1.5">
        {who.map((a) => (
          <PickedTag key={a.by} name={a.by === 'me' ? myName : partnerName} slot={a.by === 'me' ? mySlot : partnerSlot} />
        ))}
      </span>
    );
  };

  async function run(id: string, fn: () => Promise<{ error?: string }>, ok: string) {
    setPending(id);
    const res = await fn();
    setPending(null);
    toast({ message: res.error ? `Couldn’t save: ${res.error}` : ok });
  }

  if (!result) return <div className="glass h-64 animate-pulse" aria-label="Loading" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Resolve conflicts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Places where your answers and rules can’t all be true at once, or where you two disagree. Nothing is ever
            changed without you.
          </p>
        </div>
        <Link href="/app/compare" className={buttonVariants({ variant: 'secondary' })}>Back to questions</Link>
      </div>

      {conflicts.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 p-10 text-center" role="status">
          <CircleCheck className="h-8 w-8 text-accent" aria-hidden />
          <p className="card-title">No conflicts</p>
          <p className="max-w-md text-sm text-muted">Everything you’ve said fits together. The final list comes next.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="conflicts">
          {conflicts.map((c) => (
            <li key={c.id}>
              <Card tone="strong" className={cn(busy || pending === c.id ? 'opacity-60' : '', involves(c) && 'ring-2 ring-warn/60')}>
                {involves(c) ? <p className="eyebrow mb-2 text-warn">The move you just made</p> : null}
                <h2 className="card-title mb-3">{TITLES[c.kind]}</h2>
                {c.kind === 'cycle' ? (
                  <div className="flex flex-col">
                    <p className="mb-3 text-sm text-muted">
                      Each line says one pair must be above the next. Together they loop back to the start, so one has to go.
                      Tap the one that’s least true for you; only that one is dropped.
                    </p>
                    <ol className="flex flex-col">
                      {c.links!.map((l, i) => (
                        <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3">
                          {/* A timeline: one dot per statement, joined by a dashed line (no letters, which read like tiers). */}
                          <span className="flex flex-col items-center" aria-hidden>
                            <span className="mt-6 h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
                            <span className="w-0 flex-1 border-l-2 border-dashed border-border" />
                          </span>
                          <button
                            className="glass-row mb-2 flex flex-col gap-2 px-3 py-3 text-left transition-colors duration-150 hover:border-action hover:bg-action-soft sm:px-4"
                            disabled={!!pending}
                            aria-label={`${l.text} Drop this one.`}
                            onClick={() => run(c.id, () => breakLink({ from: l.from, to: l.to, reasons: l.reasons }), 'Dropped that link.')}
                          >
                            <span className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3">
                              {l.fromPair ? <PairTile pair={l.fromPair} rank={l.fromRank} /> : <span className="text-sm">{l.text}</span>}
                              <span className="flex items-center gap-1.5 text-muted md:flex-col md:gap-0.5" aria-hidden>
                                <span className="eyebrow">above</span>
                                <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" />
                              </span>
                              {l.toPair ? <PairTile pair={l.toPair} rank={l.toRank} /> : null}
                            </span>
                            <span className="flex items-start gap-2 text-[13px] leading-snug">
                              <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:gap-2">
                                <span className="eyebrow shrink-0 text-muted sm:mt-[3px]">{l.source.label}</span>
                                <span className="min-w-0">{l.source.detail}</span>
                              </span>
                              <Link2Off className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className="ml-[26px] font-mono text-xs text-muted" aria-hidden>↺ and the first is above the second again: back to the start</p>
                  </div>
                ) : null}

                {c.kind === 'surprising_answer' && c.left && c.right ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted">
                      {c.answers?.[0]?.by === 'me' ? 'You' : partnerName} picked the{' '}
                      {c.answers?.[0]?.winner === 'left' ? 'first' : 'second'} pair, but your other answers suggest the opposite.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {(['left', 'right'] as const).map((side) => {
                        const picked = c.answers?.[0]?.winner === side;
                        const by = c.answers?.[0]?.by;
                        return (
                          <PairLarge
                            key={side}
                            pair={side === 'left' ? c.left! : c.right!}
                            names={names}
                            hideTierOf={hideTierOf}
                            map={false}
                            highlight={picked}
                            tag={picked ? <PickedTag name={by === 'me' ? myName : partnerName} slot={by === 'me' ? null : partnerSlot} you={by === 'me'} /> : undefined}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!!pending} onClick={() => run(c.id, () => confirmAnswer(c.comparisonIds![0]), 'Kept, and locked in.')}>Yes, still true</Button>
                      <Button variant="secondary" disabled={!!pending} onClick={() => run(c.id, () => flipAnswer(c.comparisonIds![0]), 'Switched your answer.')}>Actually, the other one</Button>
                      <Button variant="ghost" disabled={!!pending} onClick={() => run(c.id, () => removeAnswer(c.comparisonIds![0]), 'Answer removed.')}>Remove this answer</Button>
                    </div>
                  </div>
                ) : null}

                {c.kind === 'disagreement' && c.left && c.right ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted">
                      {c.answers?.map((a, i) => (
                        <span key={i}>
                          {i ? '; ' : ''}
                          {a.by === 'me' ? `${myName} (you)` : partnerName} picked{' '}
                          {a.winner === 'tie' ? '“too close to call”' : a.winner === 'left' ? 'the first pair' : 'the second pair'}
                        </span>
                      ))}
                      . Talk it through, then choose together. Until then this answer doesn’t count.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {(['left', 'right'] as const).map((side) => (
                        <PairLarge
                          key={side}
                          pair={side === 'left' ? c.left! : c.right!}
                          names={names}
                          hideTierOf={hideTierOf}
                          map={false}
                          tag={pickedBy(c.answers, side)}
                          action={
                            <Button
                              className="w-full"
                              disabled={!!pending}
                              onClick={() => run(c.id, () => resolveDisagreement(c.left!.id, c.right!.id, side), 'Settled.')}
                            >
                              We choose this pair
                            </Button>
                          }
                        />
                      ))}
                    </div>
                    <Button variant="secondary" className="self-start" disabled={!!pending} onClick={() => run(c.id, () => resolveDisagreement(c.left!.id, c.right!.id, 'tie'), 'Settled as too close to call.')}>
                      Too close to call
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
