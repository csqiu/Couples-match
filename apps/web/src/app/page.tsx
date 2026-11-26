import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@/brand';
import { Logo } from '@/components/logo';
import { MergeBackdrop } from '@/components/merge-backdrop';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { getContext } from '@/lib/context';

/** The front door: one panel over the merging-lists animation. */
export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  if (await getContext()) redirect('/app');
  return (
    <>
      <MergeBackdrop />
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col px-4 py-5 sm:px-6">
        <header className="flex items-center justify-between">
          <Logo />
          <nav aria-label="Site" className="flex items-center gap-1">
            <Link href="/guides" className={buttonVariants({ variant: 'ghost' })}>Guides</Link>
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>Sign in</Link>
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="flex flex-1 items-start py-8 outline-none md:items-center md:py-12">
          <section className="glass w-full max-w-[560px] rounded-[32px] p-7 text-center sm:p-12 md:text-left">
            {deleted ? (
              <p className="mb-5 rounded-2xl bg-accent-soft/80 px-4 py-3 text-left text-sm text-accent" role="status">
                Your account and everything in it have been deleted.
              </p>
            ) : null}
            <p className="eyebrow text-accent">For the NRMP Couples Match</p>
            <h1 className="mt-4 font-display text-[38px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[60px]">
              {BRAND.tagline}
            </h1>
            <p className="mt-5 max-w-[440px] text-lg text-muted max-md:mx-auto">{BRAND.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row max-md:sm:justify-center">
              <Link href="/login" className={buttonVariants()}>
                Get started <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className={buttonVariants({ variant: 'secondary' })}>Read the guides</Link>
            </div>
            <Link
              href="/warmup"
              className="mt-5 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-dashed border-text/30 py-2 pr-4 pl-3 text-sm font-medium transition-colors duration-150 hover:border-solid hover:bg-glass-strong"
            >
              <span className="logo-mark origin-left scale-75" aria-hidden />
              See how it works with a quick warm-up
            </Link>
          </section>
        </main>
      </div>
    </>
  );
}
