import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Pills in ink ("action"). Partner colors never appear on controls. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-action text-action-fg shadow-button hover:bg-action-hover',
        secondary: 'glass-strong border border-glass-border text-text shadow-soft hover:bg-surface',
        outline: 'border-2 border-action bg-glass-strong text-action hover:bg-action-soft',
        ghost: 'text-text hover:bg-glass',
        danger: 'bg-danger text-white hover:opacity-90 dark:text-[#1a0f0e]',
        'danger-soft': 'glass-strong border border-glass-border text-danger shadow-soft hover:bg-surface',
      },
      size: {
        md: 'min-h-11 px-5 text-[14.5px]',
        sm: 'min-h-9 px-3.5 text-[13.5px]',
        icon: 'min-h-11 w-11 rounded-[14px] px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
