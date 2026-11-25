'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const headerIcon =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[14px] border border-transparent text-muted transition-colors duration-150 hover:border-glass-border hover:bg-glass hover:text-text';

/** A header icon link that marks itself as the current page. */
export function HeaderLink({ href, label, children, className }: { href: string; label: string; children: ReactNode; className?: string }) {
  const current = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={current ? 'page' : undefined}
      className={cn(headerIcon, current && 'glass-strong border-glass-border text-text', className)}
    >
      {children}
    </Link>
  );
}
