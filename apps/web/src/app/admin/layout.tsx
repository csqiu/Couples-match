import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND } from '@/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: { template: `%s · Admin · ${BRAND.name}`, default: `Admin · ${BRAND.name}` }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app" className="text-lg font-semibold">{BRAND.name}</Link>
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Admin</span>
        </div>
        <nav className="flex items-center gap-1 text-sm" aria-label="Admin">
          <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-surface-2">Review</Link>
          <Link href="/admin/import" className="rounded-lg px-3 py-2 hover:bg-surface-2">Import</Link>
          <Link href="/app" className="rounded-lg px-3 py-2 text-muted hover:bg-surface-2">Back to app</Link>
          <ThemeToggle />
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="min-w-0 pb-12 outline-none">{children}</main>
    </div>
  );
}
