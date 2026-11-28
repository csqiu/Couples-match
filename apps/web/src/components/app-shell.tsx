'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Wider pages (the final list and the map) get room for their side panel. */
const WIDE = ['/app/list', '/app/map'];

export function AppShell({ children }: { children: ReactNode }) {
  const wide = WIDE.some((p) => usePathname().startsWith(p));
  return <div className={cn('mx-auto flex flex-col gap-4 px-4 py-4 sm:px-6', wide ? 'max-w-6xl' : 'max-w-5xl')}>{children}</div>;
}
