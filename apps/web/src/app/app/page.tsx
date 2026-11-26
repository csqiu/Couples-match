import { ArrowRight, Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LocalTime } from '@/components/local-time';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { displayName, requireContext } from '@/lib/context';
import { continueStep, countsFromDraft, stepStatus, versionLabel, type ListCounts, type ListStep } from '@/lib/lists';
import { LIST_STEPS } from '@/lib/steps';
import { createClient } from '@/lib/supabase/server';
import { NewListDialog, OpenListButton, StarButton } from './dashboard-controls';

export const metadata: Metadata = { title: 'Dashboard' };


/** Home after setup: every list (fresh start), its saved versions, and a way to start another. */
export default async function Dashboard() {
  const ctx = await requireContext();
  if (!ctx.couple || !ctx.profile.specialty) redirect('/app/setup');
  const supabase = await createClient();
  const coupleId = ctx.couple.id;

  const [ranks, answers, resolved, lists, versions] = await Promise.all([
    supabase.from('individual_ranks').select('user_id').eq('couple_id', coupleId),
    supabase.from('comparisons').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabase.from('rule_exceptions').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabase.from('rank_lists').select('id, number, name, created_at, created_by, started_from, draft').eq('couple_id', coupleId).order('number', { ascending: false }),
    supabase
      .from('list_versions')
      .select('id, list_id, minor, name, note, created_at, created_by, starred, pair_count')
      .eq('couple_id', coupleId)
      .order('minor', { ascending: false }),
  ]);
  const mine = (ranks.data ?? []).filter((r) => r.user_id === ctx.user.id).length;
  // Onboarding: programs come before the dashboard.
  if (mine === 0 && (lists.data ?? []).length <= 1 && !(versions.data ?? []).length) redirect('/app/programs');

  const me = { id: ctx.user.id, name: displayName(ctx.profile, 'You') };
  const partner = ctx.partner ? { id: ctx.partner.user_id, name: displayName(ctx.partner) } : null;
  const people = partner ? [me, partner] : [me];
  const who = (id: string | null) => (id === me.id ? 'you' : partner && id === partner.id ? partner.name : 'someone');

  const liveCounts: ListCounts = {
    programs: Object.fromEntries(people.map((p) => [p.id, (ranks.data ?? []).filter((r) => r.user_id === p.id).length])),
    answers: answers.count ?? 0,
    resolved: resolved.count ?? 0,
  };
  const allVersions = (versions.data ?? []).map((v) => ({ ...v, pairCount: v.pair_count ?? 0 }));
  const numberOf = new Map((lists.data ?? []).map((l) => [l.id, l.number]));
  const labelOf = (v: { list_id: string; minor: number }) => versionLabel(numberOf.get(v.list_id) ?? 0, v.minor);
  const nextNumber = Math.max(0, ...(lists.data ?? []).map((l) => l.number)) + 1;

  const cards = (lists.data ?? []).map((l) => {
    const open = l.id === ctx.couple!.active_list;
    const counts = open ? liveCounts : countsFromDraft(l.draft);
    const own = allVersions.filter((v) => v.list_id === l.id);
    const status = stepStatus(counts, people, own[0]?.pairCount ?? null);
    const started = l.started_from ? allVersions.find((v) => v.id === l.started_from) : null;
    return { ...l, open, counts, own, status, starred: own.filter((v) => v.starred), from: started ? `tiers from ${labelOf(started)}` : 'blank tiers' };
  });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Dashboard</p>
          <h1 className="page-title mt-2">Your lists</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Each list is a fresh start from your individual rankings. Save versions as you go; a saved version never changes.
          </p>
        </div>
        <NewListDialog
          nextNumber={nextNumber}
          partner={partner?.name ?? null}
          versions={allVersions.map((v) => ({ id: v.id, label: labelOf(v), name: v.name }))}
        />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_36rem] flex-col gap-5" data-testid="lists">
          {cards.map((l) => (
            <Card key={l.id} className="flex flex-col gap-5" data-testid={`list-${l.number}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow text-muted">List {l.number}</span>
                    {l.open ? <span className="rounded-full bg-action px-2.5 py-0.5 text-xs font-medium text-action-fg">Open now</span> : null}
                    {l.starred.length ? (
                      <span className="rounded-full border border-warn/25 bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
                        ★ Starred: <span className="font-mono">{l.starred.map(labelOf).join(', ')}</span>
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 font-display text-[22px] leading-tight font-semibold tracking-[-0.01em]">{l.name ?? `List ${l.number}`}</h2>
                  <p className="mt-1 text-[13.5px] text-muted">
                    Started <LocalTime iso={l.created_at} className="font-mono" /> by {who(l.created_by)} · {l.from}
                  </p>
                </div>
                {l.open ? (
                  <Link href={`/app/${continueStep(l.counts, l.own.length)}`} className={buttonVariants()}>
                    Continue <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : (
                  <OpenListButton listId={l.id} listNumber={l.number} step={continueStep(l.counts, l.own.length)} partner={partner?.name ?? null} className={buttonVariants({ variant: 'secondary' })}>
                    Open List {l.number}
                  </OpenListButton>
                )}
              </div>

              <nav aria-label={`List ${l.number} steps`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LIST_STEPS.map((s) => {
                  const slug = s.slug as ListStep;
                  const done = slug === 'rank' ? l.status.rank === 'Both ranked' : slug === 'compare' ? l.counts.answers >= 5 : slug === 'list' ? l.own.length > 0 : false;
                  const inner = (
                    <>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-semibold',
                            done ? 'bg-accent-soft text-accent' : 'bg-text/6 text-muted',
                          )}
                        >
                          {done ? <Check className="h-3 w-3" aria-label="done" /> : s.n}
                        </span>
                        <span className="text-[14.5px] font-semibold">{s.short}</span>
                      </span>
                      <span className="text-[13px] text-muted">{l.status[slug]}</span>
                    </>
                  );
                  const cls = 'glass-row flex min-h-11 flex-col gap-1.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-glass-strong';
                  return l.open ? (
                    <Link key={s.slug} href={`/app/${s.slug}`} className={cls}>{inner}</Link>
                  ) : (
                    <OpenListButton key={s.slug} listId={l.id} listNumber={l.number} step={slug} partner={partner?.name ?? null} className={cls}>
                      {inner}
                    </OpenListButton>
                  );
                })}
              </nav>

              {l.own.length ? (
                <details open={l.open || l.starred.length > 0} className="group">
                  <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-[12px] px-1.5 text-[13.5px] text-muted hover:text-text">
                    {l.own.length} saved {l.own.length === 1 ? 'version' : 'versions'}
                  </summary>
                  <ol className="mt-2 flex flex-col gap-1.5">
                    {l.own.map((v) => (
                      <li key={v.id} className="glass-row flex flex-wrap items-center gap-2 py-1 pr-2 pl-1">
                        <StarButton id={v.id} label={labelOf(v)} starred={v.starred} />
                        <span className="min-w-10 font-mono text-[15px] font-semibold text-plum-deep">{labelOf(v)}</span>
                        <div className="flex min-w-0 flex-[1_1_14rem] flex-col">
                          <span className="font-medium">{v.name}</span>
                          <span className="text-[12.5px] text-muted">
                            <LocalTime iso={v.created_at} time className="font-mono" /> · saved by {who(v.created_by)} · <span className="font-mono">{v.pairCount}</span> pairs
                            {v.note ? ` · ${v.note}` : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Link href={`/print/list?version=${v.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>View</Link>
                          {l.open ? (
                            <Link href={`/app/versions?a=${v.id}&b=current`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Compare</Link>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </Card>
          ))}
        </div>

        <aside className="flex min-w-0 flex-[1_1_16rem] flex-col gap-5">
          <Card className="flex flex-col gap-3">
            <p className="eyebrow text-muted">Programs</p>
            <div className="flex gap-6">
              {people.map((p, i) => (
                <div key={p.id} className="flex flex-col">
                  <span className={cn('font-mono text-[26px] font-semibold', (ctx.role === 'a') === (i === 0) ? 'text-partner-1' : 'text-partner-2')}>
                    {liveCounts.programs[p.id] ?? 0}
                  </span>
                  <span className="text-[12.5px] text-muted">{i === 0 ? 'Yours' : `${p.name}’s`}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted">Shared by every list. A program you add goes into each list’s Tier B.</p>
            <Link href="/app/programs" className={buttonVariants({ variant: 'secondary', className: 'self-start' })}>Edit programs</Link>
          </Card>
          <Card className="flex flex-col gap-2">
            <p className="eyebrow text-muted">Your couple</p>
            <p className="text-sm">
              {me.name} (you){partner ? ` and ${partner.name}` : ' — your partner hasn’t joined yet'}
            </p>
            <Link href="/app/setup" className="text-sm font-medium text-accent hover:underline">Edit setup</Link>
          </Card>
          <Card className="flex flex-col gap-2">
            <p className="eyebrow text-muted">New here?</p>
            <p className="text-sm">How tiers, “this or that” and conflicts fit together.</p>
            <Link href="/guides/how-to-use-pairwise" className="text-sm font-medium text-accent hover:underline">How to Use Pairwise →</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
