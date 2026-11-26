import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { getContext } from '@/lib/context';
import { WarmupFlow } from './warmup-flow';

export const metadata: Metadata = {
  title: 'Theme warm-up',
  description: 'Rank four fonts and four color schemes, answer a few “this or that” questions, and see how Pairwise builds a Couples Match list.',
};

/** The theme warm-up: open to everyone, no account needed. Everything stays on this device. */
export default async function WarmupPage() {
  const signedIn = !!(await getContext());
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Logo href={signedIn ? '/app' : '/'} />
          <Link href="/guides" className="hidden text-sm text-muted hover:text-text sm:inline">Guides</Link>
        </div>
        <nav aria-label="Site" className="flex items-center gap-1">
          <Link href={signedIn ? '/app' : '/'} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden sm:inline-flex')}>
            {signedIn ? 'Back to your lists' : 'Back to Pairwise'}
          </Link>
          <ThemeToggle />
          {signedIn ? null : <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>Sign in</Link>}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="pb-12 outline-none">
        <WarmupFlow signedIn={signedIn} />
      </main>
    </div>
  );
}
