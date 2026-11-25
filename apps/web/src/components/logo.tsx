import Link from 'next/link';
import { BRAND } from '@/brand';
import { cn } from '@/lib/cn';

/** The two-circle mark and the wordmark. */
export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('inline-flex min-h-11 items-center gap-2 rounded-full font-display text-xl font-bold tracking-[-0.02em]', className)}>
      <span className="logo-mark" aria-hidden />
      {BRAND.name}
    </Link>
  );
}
