'use client';
import { cn } from '@/lib/cn';

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center"
    >
      <span className={cn('relative h-6 w-10 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-border')}>
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}
