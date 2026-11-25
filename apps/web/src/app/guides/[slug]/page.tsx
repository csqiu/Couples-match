import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { GUIDE_AUTHOR, GUIDES, guideBySlug } from '@/content/guides';
import { guideHtml } from '@/lib/guide-html';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  return g ? { title: g.title, description: g.description } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter((o) => o.slug !== g.slug);
  const date = new Date(`${g.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl py-10 outline-none sm:py-14">
      <Link href="/guides" className="text-sm text-muted hover:text-text">← All guides</Link>
      <article className="glass glass-strong mt-6 px-5 py-7 sm:px-10 sm:py-10">
        <h1 className="page-title">{g.title}</h1>
        <p className="mt-3 font-mono text-[13px] text-muted">
          {GUIDE_AUTHOR} · {date}
        </p>
        <div className="guide mt-8" dangerouslySetInnerHTML={{ __html: guideHtml(g.body) }} />
      </article>
      <aside className="glass mt-10 p-6">
        <h2 className="card-title">Build your couples list</h2>
        <p className="mt-1 text-sm text-muted">Rank your programs, answer a few questions together, and get a list ready for R3.</p>
        <Link href="/login" className={buttonVariants({ className: 'mt-4' })}>Get started</Link>
      </aside>
      <nav aria-label="More guides" className="glass mt-6 p-6">
        <h2 className="eyebrow text-muted">More guides</h2>
        <ul className="mt-3 flex flex-col gap-1.5">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/guides/${o.slug}`} className="text-accent underline-offset-2 hover:underline">{o.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
