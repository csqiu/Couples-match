import { ArrowRight, Heart, MapPin, Scale } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@/brand';
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
        <span className="text-lg font-semibold">{BRAND.name}</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
            Sign in
          </Link>
        </div>
      </header>
      {deleted ? (
        <p className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent" role="status">
          Your account and everything in it have been deleted.
        </p>
      ) : null}
      <section className="py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{BRAND.tagline}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">{BRAND.description}</p>
        <Link href="/login" className={buttonVariants({ className: 'mt-8' })}>
          Get started <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-surface p-5">
            <Icon className="h-5 w-5 text-accent" aria-hidden />
            <h2 className="mt-3 font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>
      <section className="pb-20" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">How it works</h2>
        <p className="mt-1 text-sm text-muted">Take as many sittings as you like. Everything saves as you go.</p>
        <ol className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {HOW.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden>
                {i + 1}
              </span>
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
