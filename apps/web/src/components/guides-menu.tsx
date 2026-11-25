'use client';
import { ArrowRight, BookOpen, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { headerIcon } from './header-link';

export interface GuideLink {
  slug: string;
  title: string;
  description: string;
}

/** "Guides" at the top right: the published guides, one click away from anywhere in the app. */
export function GuidesMenu({ guides }: { guides: GuideLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(headerIcon, 'gap-1.5 px-2.5 text-sm', open && 'glass-strong border-glass-border text-text')}
      >
        <BookOpen className="h-5 w-5" aria-hidden />
        <span className="hidden sm:inline">Guides</span>
        <span className="sr-only sm:hidden">Guides</span>
        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
      </button>
      {open ? (
        <nav
          id={id}
          aria-label="Guides"
          className="absolute top-full right-0 z-30 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-0.5 rounded-[20px] border border-border bg-surface p-2 shadow-glass"
        >
          <span className="eyebrow px-3 pt-2 pb-1.5 text-muted">Guides</span>
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="flex min-h-11 flex-col rounded-[14px] px-3 py-2 hover:bg-surface-2">
              <span className="text-[14.5px] font-semibold">{g.title}</span>
              <span className="line-clamp-1 text-[12.5px] text-muted">{g.description}</span>
            </Link>
          ))}
          <div className="mx-2 my-1 h-px bg-border" />
          <Link href="/guides" className="flex min-h-11 items-center justify-between rounded-[14px] px-3 text-sm font-medium text-accent hover:bg-surface-2">
            All guides <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
