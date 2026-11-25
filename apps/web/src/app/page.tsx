import { ArrowRight, Heart, MapPin, Scale } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@/brand';
import { Logo } from '@/components/logo';
import { BandBadge } from '@/components/proximity';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { getContext } from '@/lib/context';

const HOW = [
  ['Set up together', 'Each of you signs in, picks your specialty, and one of you invites the other.'],
  ['Choose programs', 'Each of you adds every program you’d be willing to go to.'],
  ['Rank and tier', 'Put your own programs in order, and mark the ones you’d take over any other (Tier A).'],
  ['This or that', 'Answer a few questions like “both at your #1s, far apart, or both at your #4s in one city?”'],
  ['Fix contradictions', 'If answers go in a circle, we show why and you decide.'],
  ['Your final list', 'One ordered list of pairs, color-coded by distance, ready to type into R3.'],
];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  if (await getContext()) redirect('/app');
  const points = [
    { icon: Heart, title: 'Honest preferences, not strategy', body: 'The Match reads your list from the top, so the best list is simply your true order. We help you find it.' },
    { icon: MapPin, title: 'Distance, made explicit', body: 'Every pair shows how far apart you would be — together, commutable, drivable or apart.' },
    { icon: Scale, title: 'Trade-offs you can see', body: 'A few "this or that" questions learn how much being close matters to you, and catch contradictions.' },
  ];
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 outline-none sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <Link href="/guides" className={buttonVariants({ variant: 'ghost' })}>
            Guides
          </Link>
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
            Sign in
          </Link>
        </div>
      </header>
      {deleted ? (
        <p className="mt-6 rounded-2xl border border-glass-border bg-accent-soft/80 px-4 py-3 text-sm text-accent" role="status">
          Your account and everything in it have been deleted.
        </p>
      ) : null}
      <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow text-accent">For the NRMP Couples Match</p>
          <h1 className="mt-4 max-w-2xl font-display text-[38px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[60px]">{BRAND.tagline}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{BRAND.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={buttonVariants()}>
              Get started <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="#how" className={buttonVariants({ variant: 'secondary' })}>
              See how it works
            </Link>
          </div>
        </div>
        <HeroPreview />
      </section>
      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="glass p-5 sm:p-6">
            <Icon className="h-5 w-5 text-accent" aria-hidden />
            <h2 className="small-title mt-3">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>
      <section className="scroll-mt-6 pb-20" id="how" aria-labelledby="how-title">
        <h2 id="how-title" className="section-title">How it works</h2>
        <p className="mt-2 text-sm text-muted">Take as many sittings as you like. Everything saves as you go.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOW.map(([title, body], i) => (
            <li key={title} className="glass flex flex-col gap-2 rounded-[20px] p-5">
              <span className="font-mono text-sm font-semibold text-plum-deep" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="small-title block">{title}</span>
              <span className="block text-sm text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

const PREVIEW = [
  { rank: 1, a: 'Boston', b: 'Boston', band: 'together', label: 'Together', mi: 2 },
  { rank: 2, a: 'Boston', b: 'Providence', band: 'commutable', label: 'Commutable', mi: 48 },
  { rank: 3, a: 'Chicago', b: 'Milwaukee', band: 'drivable', label: 'Drivable', mi: 89 },
] as const;

/** Decorative: a peek at a final list and a "this or that" card. Hidden from assistive tech. */
function HeroPreview() {
  return (
    <div className="relative hidden min-h-[430px] sm:block" aria-hidden>
      <div className="glass glass-strong absolute top-0 right-0 left-6 p-4">
        <p className="eyebrow mb-3 text-muted">Final list</p>
        <ol className="flex flex-col gap-1.5">
          {PREVIEW.map((r) => (
            <li key={r.rank} className={`flex items-center gap-3 rounded-[16px] border border-glass-border px-3 py-2.5 ${r.band === 'together' ? 'bg-accent-soft/70' : r.band === 'commutable' ? 'bg-accent-soft/35' : 'bg-glass-row'}`}>
              <span className="w-5 font-mono text-[15px] font-semibold text-plum-deep">{r.rank}</span>
              <span className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-partner-1" />{r.a}</span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-partner-2" />{r.b}</span>
              </span>
              <BandBadge band={r.band} bandLabel={r.label} distanceMi={r.mi} />
            </li>
          ))}
        </ol>
      </div>
      <div className="glass glass-strong absolute bottom-0 left-0 w-64 p-4">
        <p className="eyebrow text-muted">This or that</p>
        <p className="mt-2 font-display text-[15.5px] leading-snug font-semibold">Both at your #1s, far apart — or both at your #4s in one city?</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-action-fg">This</span>
          <span className="rounded-full border border-glass-border bg-glass-strong px-3 py-1.5 text-xs font-semibold">That</span>
        </div>
      </div>
    </div>
  );
}
