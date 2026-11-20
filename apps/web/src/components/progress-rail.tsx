'use client';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { STEPS } from '@/lib/steps';

/** The six-step path. Every built step stays editable; later steps are shown as coming soon. */
export function ProgressRail({ done, locked }: { done: string[]; locked: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Steps" className="relative overflow-x-auto">
      <ol className="flex min-w-max gap-1 sm:gap-2">
        {STEPS.map((s) => {
          const current = pathname.startsWith(`/app/${s.slug}`);
          const isDone = done.includes(s.slug);
          const disabled = s.comingSoon || (locked && s.slug !== 'setup');
          const inner = (
            <>
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  current ? 'bg-accent text-accent-fg' : isDone ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                )}
              >
                {isDone && !current ? <Check className="h-3.5 w-3.5" aria-hidden /> : s.n}
              </span>
              <span className={cn('text-sm', current ? 'font-semibold text-text' : 'text-muted')}>{s.short}</span>
              {s.comingSoon ? <span className="sr-only">(coming soon)</span> : null}
            </>
          );
          return (
            <li key={s.slug}>
              {disabled ? (
                <span className="flex min-h-11 items-center gap-2 rounded-lg px-2 opacity-50" aria-disabled>
                  {inner}
                </span>
              ) : (
                <Link
                  href={`/app/${s.slug}`}
                  aria-current={current ? 'step' : undefined}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-surface-2"
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
