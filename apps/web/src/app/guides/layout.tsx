import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <Link href="/guides" className="text-sm text-muted hover:text-text">Guides</Link>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>Sign in</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
