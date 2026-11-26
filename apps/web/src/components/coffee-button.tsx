'use client';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { BRAND } from '@/brand';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * A link to Buy Me a Coffee, drawn as one of our own pills. Their widget
 * script is not used: the CSP allows no third-party scripts (rank lists are sensitive).
 */
export function CoffeeButton({ variant = 'secondary', className }: { variant?: 'primary' | 'secondary'; className?: string }) {
  return (
    <a href={BRAND.donateUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant, size: 'sm' }), 'print:hidden', className)}>
      <span aria-hidden>☕</span> Buy us a coffee
    </a>
  );
}

/**
 * The thank-you card shown after an export. On its own it floats at the bottom
 * right; inside a `FloatingStack` it sits on top of the other floating notices.
 */
export function FloatingCoffee({ onClose, docked = false }: { onClose: () => void; docked?: boolean }) {
  return (
    <div
      role="complementary"
      aria-label={`Support ${BRAND.name}`}
      className={cn(
        'glass glass-strong pointer-events-auto flex items-center gap-3 rounded-[20px] py-2.5 pr-2 pl-3.5 print:hidden',
        !docked && 'fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6',
      )}
    >
      <span className="logo-mark" aria-hidden />
      <div className="min-w-0 leading-tight">
        <p className="font-display text-[15px] font-bold tracking-[-0.02em]">{BRAND.name}</p>
        <p className="whitespace-nowrap text-xs text-muted"><span className="hidden sm:inline">Free to use. </span>Did it help?</p>
      </div>
      <CoffeeButton variant="primary" className="shrink-0" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-glass hover:text-text"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** Bottom-right column for floating cards: the first child sits on top. */
export function FloatingStack({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-16 z-40 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 print:hidden">
      {children}
    </div>
  );
}
