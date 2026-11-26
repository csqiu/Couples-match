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
      <span className={cn('relative h-[26px] w-11 rounded-full transition-colors duration-150', checked ? 'bg-action' : 'bg-border')}>
        <span
          className={cn(
            'absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-transform duration-150',
            checked && 'translate-x-[18px]',
          )}
        />
      </span>
    </button>
  );
}
