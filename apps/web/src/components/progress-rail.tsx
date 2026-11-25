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
    <nav aria-label="Steps" className="glass relative max-w-full overflow-x-auto rounded-full p-1.5">
      <ol className="flex min-w-max gap-1">
        {STEPS.map((s) => {
          const current = pathname.startsWith(`/app/${s.slug}`);
          const isDone = done.includes(s.slug);
          const disabled = s.comingSoon || (locked && s.slug !== 'setup');
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
              {s.comingSoon ? <span className="sr-only">(coming soon)</span> : null}
            </>
          );
          return (
            <li key={s.slug}>
              {disabled ? (
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
      </ol>
    </nav>
  );
}
