import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { guideHtml } from '@/lib/guide-html';

/** A legal document (Privacy Policy, Terms of Use) in the same reading layout as the guides. */
export function LegalPage({ title, markdown }: { title: string; markdown: string }) {
  return (
    <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl py-10 outline-none sm:py-14">
        <article className="glass glass-strong px-5 py-7 sm:px-10 sm:py-10">
          <h1 className="page-title">{title}</h1>
          <div className="guide mt-8" dangerouslySetInnerHTML={{ __html: guideHtml(markdown) }} />
        </article>
        <p className="mt-6 text-sm text-muted">
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          {' · '}
          <Link href="/terms" className="underline underline-offset-2">Terms of Use</Link>
        </p>
      </main>
    </div>
  );
}
