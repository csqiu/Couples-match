import { ArrowRight, Heart, MapPin, Scale } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { getContext } from '@/lib/context';

export default async function Home() {
  if (await getContext()) redirect('/app');
  const points = [
    { icon: Heart, title: 'Honest preferences, not strategy', body: 'The Match reads your list from the top, so the best list is simply your true order. We help you find it.' },
    { icon: MapPin, title: 'Distance, made explicit', body: 'Every pair shows how far apart you would be — together, commutable, drivable or apart.' },
    { icon: Scale, title: 'Trade-offs you can see', body: 'A few "this or that" questions learn how much being close matters to you, and catch contradictions.' },
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">{BRAND.name}</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
            Sign in
          </Link>
        </div>
      </header>
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
    </main>
  );
}
