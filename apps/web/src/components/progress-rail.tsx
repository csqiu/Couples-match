'use client';
import { ArrowLeft, Check, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { LIST_PAGES, LIST_STEPS, ONBOARDING_STEPS, type Step } from '@/lib/steps';

export interface OpenList {
  number: number;
  name: string | null;
  /** "3.1", or null before the first save. */
  lastSaved: string | null;
}

/**
 * Navigation under the header. Setup and Programs show the onboarding steps;
 * pages inside a list show which list is open and its four steps; the
 * dashboard, account and activity pages show nothing here.
 */
export function ProgressRail({ done, locked, list }: { done: string[]; locked: boolean; list: OpenList | null }) {
  const pathname = usePathname();
  const page = pathname.split('/')[2] ?? '';
  if (page === 'setup' || page === 'programs') {
    return <Rail label="Setup steps" steps={ONBOARDING_STEPS} done={done} isLocked={(s) => locked && s.slug !== 'setup'} dashboard={!locked} />;
  }
  if (!LIST_PAGES.includes(page) || !list) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-[20px] py-1.5 pr-2 pl-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <Link href="/app" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
          </Link>
          <span aria-hidden className="text-muted">/</span>
          <span className="px-2 font-display text-[15.5px] font-semibold" data-testid="open-list">
            List {list.number}
            {list.name ? <span className="font-normal text-muted"> · {list.name}</span> : null}
          </span>
          <span className="rounded-full bg-text/6 px-2.5 py-0.5 font-mono text-xs">
            {list.lastSaved ? `last saved ${list.lastSaved}` : 'not saved yet'}
          </span>
        </div>
        <Link href="/app/versions" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Versions</Link>
      </div>
      <Rail label="Steps" steps={LIST_STEPS} done={done} isLocked={() => false} />
    </div>
  );
}

function Rail({ label, steps, done, isLocked, dashboard }: { label: string; steps: Step[]; done: string[]; isLocked: (s: Step) => boolean; dashboard?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="glass relative max-w-full overflow-x-auto rounded-full p-1.5">
      <ol className="flex min-w-max gap-1">
        {steps.map((s) => {
          const current = pathname.startsWith(`/app/${s.slug}`);
          const isDone = done.includes(s.slug);
          const inner = (
            <>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold',
                  current ? 'bg-action text-action-fg' : isDone ? 'bg-accent-soft text-accent' : 'bg-text/6 text-muted',
                )}
              >
                {isDone && !current ? <Check className="h-3.5 w-3.5" aria-hidden /> : s.n}
              </span>
              <span className={cn('text-sm', current ? 'font-semibold text-text' : 'text-muted')}>{s.short}</span>
            </>
          );
          return (
            <li key={s.slug}>
              {isLocked(s) ? (
                <span className="flex min-h-10 items-center gap-2 rounded-full pr-3.5 pl-1.5 opacity-50" aria-disabled>
                  {inner}
                </span>
              ) : (
                <Link
                  href={`/app/${s.slug}`}
                  aria-current={current ? 'step' : undefined}
                  className={cn('flex min-h-10 items-center gap-2 rounded-full pr-3.5 pl-1.5 transition-colors duration-150', current ? 'bg-surface shadow-soft' : 'hover:bg-glass-strong')}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
        {dashboard ? (
          <li>
            <Link href="/app" className="flex min-h-10 items-center gap-2 rounded-full pr-3.5 pl-1.5 transition-colors duration-150 hover:bg-glass-strong">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-text/6 text-muted">
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="text-sm text-muted">Dashboard</span>
            </Link>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
