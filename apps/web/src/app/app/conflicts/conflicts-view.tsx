'use client';
import type { CoupleData } from '@pairwise/db';
import { CircleCheck, Link2Off } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import type { ConflictView } from '@/lib/analysis';
import { useAnalysis } from '@/lib/use-analysis';
import { PairCard } from '../compare/compare-view';
import { breakLink, confirmAnswer, flipAnswer, removeAnswer, resolveDisagreement, setTierAPriority } from './actions';

const TITLES: Record<ConflictView['kind'], string> = {
  cycle: 'These answers go in a circle',
  tier_a_collision: 'Who gets priority for Tier A?',
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
  const [pending, setPending] = useState<string | null>(null);
  const toast = useToast();
  const hideTierOf = privateTiers ? (role === 'a' ? 1 : 0) : null;
  const myName = role === 'a' ? names[0] : names[1];
  const partnerName = role === 'a' ? names[1] : names[0];

  async function run(id: string, fn: () => Promise<{ error?: string }>, ok: string) {
    setPending(id);
    const res = await fn();
    setPending(null);
    toast({ message: res.error ? `Couldn’t save: ${res.error}` : ok });
  }

  if (!result) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" aria-label="Loading" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resolve conflicts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Places where your answers and rules can’t all be true at once, or where you two disagree. Nothing is ever
            changed without you.
          </p>
        </div>
        <Link href="/app/compare" className={buttonVariants({ variant: 'secondary' })}>Back to questions</Link>
      </div>

      {result.conflicts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center" role="status">
          <CircleCheck className="h-8 w-8 text-accent" aria-hidden />
          <p className="font-medium">No conflicts</p>
          <p className="max-w-md text-sm text-muted">Everything you’ve said fits together. The final list comes next.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="conflicts">
          {result.conflicts.map((c) => (
            <li key={c.id}>
              <Card className={busy || pending === c.id ? 'opacity-60' : ''}>
                <h2 className="mb-3 font-semibold">{TITLES[c.kind]}</h2>
                {c.kind === 'cycle' ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted">Tap the statement that’s least true for you; we’ll drop just that one.</p>
                    {c.links!.map((l, i) => (
                      <button
                        key={i}
                        className="flex min-h-11 items-start gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-accent hover:bg-accent-soft"
                        disabled={!!pending}
                        onClick={() => run(c.id, () => breakLink({ from: l.from, to: l.to, reasons: l.reasons }), 'Dropped that link.')}
                      >
                        <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                        <span>{l.text}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {c.kind === 'tier_a_collision' ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted">
                      You both have Tier A programs. When only one of you can get one, whose Tier A comes first? For example:
                    </p>
                    {c.left && c.right ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <PairCard pair={c.left} names={names} hideTierOf={hideTierOf} />
                        <PairCard pair={c.right} names={names} hideTierOf={hideTierOf} />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!!pending} onClick={() => run(c.id, () => setTierAPriority('partner1'), `${names[0]}’s Tier A comes first.`)}>
                        {names[0]} gets priority
                      </Button>
                      <Button disabled={!!pending} onClick={() => run(c.id, () => setTierAPriority('partner2'), `${names[1]}’s Tier A comes first.`)}>
                        {names[1]} gets priority
                      </Button>
                      <Button variant="secondary" disabled={!!pending} onClick={() => run(c.id, () => setTierAPriority('case_by_case'), 'We’ll decide case by case.')}>
                        Decide case by case
                      </Button>
                    </div>
                  </div>
                ) : null}

                {c.kind === 'surprising_answer' && c.left && c.right ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted">
                      {c.answers?.[0]?.by === 'me' ? 'You' : partnerName} picked the{' '}
                      {c.answers?.[0]?.winner === 'left' ? 'first' : 'second'} pair, but your other answers suggest the opposite.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <PairCard pair={c.left} names={names} hideTierOf={hideTierOf} highlight={c.answers?.[0]?.winner === 'left'} />
                      <PairCard pair={c.right} names={names} hideTierOf={hideTierOf} highlight={c.answers?.[0]?.winner === 'right'} />
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
                        <PairCard
                          key={side}
                          pair={side === 'left' ? c.left! : c.right!}
                          names={names}
                          hideTierOf={hideTierOf}
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
