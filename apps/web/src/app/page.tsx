import { ArrowRight, CarFront, Heart } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@/brand';
import { LookSwatch } from '@/components/look-preview';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { getContext } from '@/lib/context';
import { FONTS, PALETTES } from '@/lib/looks';

const STEPS = [
  ['01', 'Rank', 'Each of you puts your own programs in true order and sorts them into tiers.'],
  ['02', 'Compare', 'Answer “this or that” questions with your partner. Each answer teaches the engine your trade-offs.'],
  ['03', 'Resolve conflicts', 'When two answers can’t both be true, it shows you the loop and you choose what gives way.'],
  ['04', 'Double check', 'See why each pair sits where it does, try possible outcomes, and work through the R3 checklist.'],
] as const;

const panel = 'glass landing-float w-full rounded-[32px] p-7 sm:p-12';
const screen = 'flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-6';

/**
 * The front door: a fixed, slowly swirling sage-and-plum background, with panels that
 * float in and out as you scroll (globals.css: .landing-swirl, .landing-float).
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  if (await getContext()) redirect('/app');
  return (
    <>
      <div className="landing-swirl" aria-hidden>
        <div className="orbit">
          <i className="g1" />
          <i className="g2" />
          <i className="g3" />
          <i className="g4" />
        </div>
      </div>

      <div className="relative z-10">
        <section aria-labelledby="hero-title" className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-5 sm:px-6">
          <header className="flex items-center justify-between">
            <Logo />
            <nav aria-label="Site" className="flex items-center gap-1">
              <Link href="/guides" className={buttonVariants({ variant: 'ghost' })}>Guides</Link>
              <ThemeToggle />
              <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>Sign in</Link>
            </nav>
          </header>
          <main id="main" tabIndex={-1} className="flex flex-1 items-center py-10 outline-none md:py-16">
            <div className={`${panel} max-w-[560px] text-center md:text-left`}>
              {deleted ? (
                <p className="mb-5 rounded-2xl bg-accent-soft/80 px-4 py-3 text-left text-sm text-accent" role="status">
                  Your account and everything in it have been deleted.
                </p>
              ) : null}
              <p className="eyebrow text-accent">For the NRMP Couples Match</p>
              <h1 id="hero-title" className="mt-4 font-display text-[38px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[60px]">
                {BRAND.tagline}
              </h1>
              <p className="mt-5 max-w-[440px] text-lg text-muted max-md:mx-auto">
                Collaboratively create a couples match list without giving up your favorite programs
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row max-md:sm:justify-center">
                <Link href="/login" className={buttonVariants()}>
                  Get started <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/guides" className={buttonVariants({ variant: 'secondary' })}>Read the guides</Link>
              </div>
            </div>
          </main>
          <span className="landing-cue eyebrow inline-flex items-center gap-2 self-center text-muted md:self-start" aria-hidden>
            <i />
            Scroll
          </span>
        </section>

        <section aria-labelledby="couples-title" className={screen}>
          <div className="mx-auto flex w-full max-w-6xl justify-end">
            <article className={`${panel} glass-strong max-w-[600px]`}>
              <h2 id="couples-title" className="font-display text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] sm:text-[40px]">
                Built for couples at any stage of their relationship.
              </h2>
              <p className="mt-4 max-w-[52ch] text-[17px] text-muted">
                For married-with-kids, just-met-during-electives, and everyone in between. Give yourselves a chance at matching
                together without sacrificing your match outcome.
              </p>
              <ol className="mt-6 flex flex-col gap-2" aria-label="Example: three pairs on a couple’s list">
                <PairRow n={1} a="UCSF" b="UCSF Benioff" together />
                <PairRow n={2} a="UCSF" b="Stanford" miles={34} />
                <PairRow n={3} a="Penn" b="CHOP" together />
              </ol>
              <p className="mt-3 text-[13.5px] text-muted">
                “If they can match at UCSF, then I want to be in the Bay Area too.” Pairwise helps you encode preference
                dependencies and keep your entire list true to what you want.
              </p>
            </article>
          </div>
        </section>

        <section aria-labelledby="engine-title" className={screen}>
          <div className="mx-auto w-full max-w-6xl">
            <article className={`${panel} glass-strong mx-auto max-w-[1040px]`}>
              <h2 id="engine-title" className="font-display text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">
                A logic engine to keep your list clear and true
              </h2>
              <p className="mt-4 max-w-[60ch] text-[17px] text-muted">
                No need to discuss hundreds of possibilities and comparisons. Pairwise uses your preferences to build your
                complete list and highlights the most important decisions to discuss with your partner.
              </p>
              <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map(([k, title, body]) => (
                  <li key={k} className="glass-row flex flex-col gap-2 rounded-[20px] p-[18px]">
                    <span className="font-mono text-[13px] font-semibold text-muted">{k}</span>
                    <h3 className="font-display text-[19px] leading-tight font-semibold tracking-[-0.01em]">{title}</h3>
                    <p className="text-[13.5px] leading-normal text-muted">{body}</p>
                  </li>
                ))}
              </ol>
            </article>
          </div>
        </section>

        <section aria-labelledby="warmup-title" className={screen}>
          <div className="mx-auto w-full max-w-6xl">
            <article className={`${panel} glass-strong max-w-[620px]`}>
              <h2 id="warmup-title" className="font-display text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">
                See how it works by couples-matching your Pairwise theme.
              </h2>
              <div className="mt-6 grid grid-cols-[2.5rem_repeat(4,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[3.25rem_repeat(4,minmax(0,1fr))]" aria-hidden>
                <span />
                {PALETTES.map((p) => (
                  <span key={p.id} data-palette={p.id} className="flex flex-col items-center gap-1 text-center font-mono text-[10.5px] leading-tight text-muted">
                    <span className="flex h-2.5 w-full overflow-hidden rounded-[5px]">
                      <i className="flex-1 bg-partner-1" />
                      <i className="flex-1 bg-partner-2" />
                    </span>
                    {p.name}
                  </span>
                ))}
                {FONTS.map((f, i) => (
                  <FontRow key={f.id} font={f.id} first={i === 0} />
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/warmup" className={buttonVariants()}>
                  Start the warm-up <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <span className="text-[13px] text-muted">About 2 minutes · no account needed</span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}

function PairRow({ n, a, b, together, miles }: { n: number; a: string; b: string; together?: boolean; miles?: number }) {
  return (
    <li className="glass-row grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 text-sm">
      <span className="text-right font-mono font-semibold text-plum-deep">{n}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-partner-1">{a}</span>
        <span className="text-muted">+</span>
        <span className="font-semibold text-partner-2">{b}</span>
      </span>
      {together ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-band-together/12 px-2.5 py-1.5 text-xs font-semibold text-band-together">
          <Heart className="h-3.5 w-3.5" aria-hidden /> Together
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-band-commutable/12 px-2.5 py-1.5 text-xs font-semibold text-band-commutable">
          <CarFront className="h-3.5 w-3.5" aria-hidden /> Commutable · <span className="font-mono">{miles} mi</span>
        </span>
      )}
    </li>
  );
}

function FontRow({ font, first }: { font: (typeof FONTS)[number]['id']; first: boolean }) {
  return (
    <>
      <span data-font={font} className="font-display text-[20px] leading-none font-semibold">Aa</span>
      {PALETTES.map((p, j) => (
        <span key={p.id} className={first && j === 0 ? 'rounded-[12px] p-[3px] ring-2 ring-action' : 'p-[3px]'}>
          <LookSwatch font={font} palette={p.id} className="h-10 w-full" />
        </span>
      ))}
    </>
  );
}
