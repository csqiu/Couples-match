import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from '@/content/guides';

export const metadata: Metadata = {
  title: 'Guides',
  description: 'How the NRMP Couples Match works, and how to build a couples rank list that says what you mean.',
};

export default function GuidesIndex() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl py-10 outline-none sm:py-14">
      <h1 className="page-title">Guides</h1>
      <p className="mt-3 max-w-2xl text-muted">
        How the Couples Match reads your list, why couples lists are hard to get right, and how to use Pairwise to build one
        that says what you mean.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="group glass block p-5 transition-colors duration-150 hover:bg-glass-strong sm:p-6">
              <h2 className="card-title flex items-center justify-between gap-3">
                {g.title}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted group-hover:text-text" aria-hidden />
              </h2>
              <p className="mt-1 text-sm text-muted">{g.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
