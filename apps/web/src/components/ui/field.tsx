import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full min-h-[46px] rounded-[14px] border border-border bg-glass-strong px-3.5 text-[15px] text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

/** A chevron drawn in the muted color (the native select keeps its behavior). */
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888d80' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: CHEVRON }} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-semibold text-text', className)} {...props} />;
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-[12.5px] text-muted">{hint}</p> : null}
    </div>
  );
}
