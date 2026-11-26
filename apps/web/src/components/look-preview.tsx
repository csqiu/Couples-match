import { Heart, CarFront } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { FontId, Look, PaletteId } from '@/lib/looks';

/**
 * A miniature Pairwise screen drawn in a look (lib/looks.ts): its fonts and colors apply
 * inside this box only. Decorative sample content, hidden from screen readers; callers
 * name the look in text.
 */
export function LookPreview({ look, size = 'md', className }: { look: Look; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const lg = size === 'lg';
  return (
    <div
      data-font={look.font}
      data-palette={look.palette}
      aria-hidden
      className={cn(
        'relative isolate flex flex-col overflow-hidden border border-border bg-bg text-text',
        size === 'sm' ? 'gap-2 rounded-[14px] p-3' : lg ? 'gap-4 rounded-[20px] p-5' : 'gap-3 rounded-[18px] p-4',
        className,
      )}
    >
      <i className="absolute -top-1/4 -left-1/5 -z-10 aspect-square w-3/5 rounded-full bg-[var(--blob-1)] opacity-60 blur-2xl" />
      <i className="absolute -right-1/5 -bottom-1/3 -z-10 aspect-square w-3/5 rounded-full bg-[var(--blob-2)] opacity-60 blur-2xl" />
      <div className="flex items-center justify-between">
        <span className={cn('flex items-center gap-1.5 font-display font-bold tracking-[-0.02em]', size === 'sm' ? 'text-[13px]' : 'text-[15px]')}>
          <span className="logo-mark scale-[0.65] origin-left -mr-2" />
          Pairwise
        </span>
        <span className="flex">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-partner-1 text-[9.5px] font-bold text-partner-fg">Y</span>
          <span className="-ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-partner-2 text-[9.5px] font-bold text-partner-fg ring-2 ring-bg">P</span>
        </span>
      </div>
      <p className={cn('font-display leading-[1.08] font-semibold tracking-[-0.02em] text-balance', size === 'sm' ? 'text-[15px]' : lg ? 'text-[28px]' : 'text-[20px]')}>
        The smart way to couples match.
      </p>
      {size === 'sm' ? null : (
        <div className="glass flex flex-col gap-1.5 rounded-[14px] p-2.5">
          <Row n={1} a="UCSF" b="UCSF Benioff" band="together" />
          <Row n={2} a="Penn" b="CHOP" band="together" />
          {lg ? <Row n={3} a="UCSF" b="Stanford" band="commutable" /> : null}
        </div>
      )}
      <div className="flex">
        <span className={cn('rounded-full bg-action font-semibold text-action-fg', size === 'sm' ? 'px-2.5 py-1 text-[10.5px]' : 'px-3.5 py-1.5 text-xs')}>
          Get started
        </span>
      </div>
    </div>
  );
}

function Row({ n, a, b, band }: { n: number; a: string; b: string; band: 'together' | 'commutable' }) {
  const Icon = band === 'together' ? Heart : CarFront;
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className="w-3 font-mono text-xs font-semibold text-plum-deep">{n}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-partner-1">{a}</span> · <span className="font-semibold text-partner-2">{b}</span>
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold',
          band === 'together' ? 'bg-band-together/12 text-band-together' : 'bg-band-commutable/12 text-band-commutable',
        )}
      >
        <Icon className="h-3 w-3" />
        {band === 'together' ? 'Together' : '34 mi'}
      </span>
    </div>
  );
}

/** A tiny "Aa" chip in a look: its display font, partner colors and ink. */
export function LookSwatch({ font, palette, className }: { font: FontId; palette: PaletteId; className?: string }) {
  return (
    <span
      data-font={font}
      data-palette={palette}
      aria-hidden
      className={cn('inline-flex h-11 w-16 shrink-0 flex-col justify-between rounded-[10px] border border-border bg-bg px-2 py-1.5', className)}
    >
      <span className="font-display text-[17px] leading-none font-semibold text-text">Aa</span>
      <span className="flex gap-1">
        <i className="h-2 w-2 rounded-full bg-partner-1" />
        <i className="h-2 w-2 rounded-full bg-partner-2" />
        <i className="h-2 w-2 rounded-full bg-action" />
      </span>
    </span>
  );
}
