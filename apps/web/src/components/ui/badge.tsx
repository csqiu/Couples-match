import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  plum: 'bg-partner-2-soft text-plum-deep',
} as const;

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs leading-none font-semibold whitespace-nowrap', tones[tone], className)}
      {...props}
    />
  );
}

const TIER = {
  A: 'bg-tier-a text-tier-a-fg',
  B: 'bg-partner-2-soft text-tier-b ring-1 ring-inset ring-tier-b/30',
  C: 'text-tier-c ring-[1.5px] ring-inset ring-border',
} as const;

/** A 24px square with the tier letter. The full name is in the label, so the letter is never the only signal. */
export function TierBadge({ tier, className }: { tier: 'A' | 'B' | 'C'; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] font-mono text-xs font-semibold', TIER[tier], className)}
      title={`Tier ${tier}`}
    >
      <span aria-hidden>{tier}</span>
      <span className="sr-only">Tier {tier}</span>
    </span>
  );
}
