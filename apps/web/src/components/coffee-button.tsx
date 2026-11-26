'use client';
import { X } from 'lucide-react';
import { BRAND } from '@/brand';
import { cn } from '@/lib/cn';

/**
 * Buy Me a Coffee's yellow button, drawn here as a plain link. Their widget
 * script is not used: the CSP allows no third-party scripts (rank lists are sensitive).
 */
export function CoffeeButton({ className }: { className?: string }) {
  return (
    <a
      href={BRAND.donateUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-lg border border-black bg-[#FFDD00] px-4 text-sm font-semibold text-black hover:brightness-95 print:hidden',
        className,
      )}
    >
      <span aria-hidden>☕</span> Buy me a coffee
    </a>
  );
}

/** The coffee button floated at the bottom right, shown after an export. */
export function FloatingCoffee({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="complementary"
      aria-label="Support Pairwise"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg print:hidden"
    >
      <span className="hidden px-2 text-xs text-muted sm:inline">Pairwise is free. Did it help?</span>
      <CoffeeButton />
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
