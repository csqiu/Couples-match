import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  default: '',
  /** Dense panels: comparison options, conflict cards, sign-in. */
  strong: 'glass-strong',
  danger: 'border-danger/35 bg-danger-soft/60',
} as const;

export function Card({ className, tone = 'default', ...props }: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones }) {
  return <div className={cn('glass p-5 sm:p-6', tones[tone], className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-[19px] leading-[1.2] font-semibold tracking-[-0.01em]">{title}</h2>
        {description ? <p className="mt-1 text-[13.5px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
