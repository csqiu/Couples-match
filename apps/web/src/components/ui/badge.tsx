import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  A: 'bg-accent-soft text-tier-a',
  B: 'bg-surface-2 text-tier-b',
  C: 'bg-surface-2 text-tier-c',
} as const;

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}
      {...props}
    />
  );
}
