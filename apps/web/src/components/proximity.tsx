import type { Band } from '@pairwise/engine';
import { Car, CarFront, Heart, Plane, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Proximity styling (spec Section 7), used everywhere a pair appears. Color is
 * never the only signal: every band also has a text badge and an icon.
 */
export const BAND_ICON = { together: Heart, commutable: CarFront, drivable: Car, apart: Plane, no_match: TriangleAlert } as const;

export const BAND_ROW: Record<Band, string> = {
  together: 'bg-accent-soft/70 border-glass-border',
  commutable: 'bg-accent-soft/35 border-glass-border',
  drivable: 'bg-glass-row border-glass-border',
  apart: 'bg-glass-row border-glass-border text-muted',
  no_match: 'border-[1.5px] border-dashed border-warn bg-glass/35',
};

/** Band chip colors: text in the band color on a 12% fill; No Match is an amber outline. */
const BAND_CHIP: Record<Band, string> = {
  together: 'bg-band-together/12 text-band-together',
  commutable: 'bg-band-commutable/12 text-band-commutable',
  drivable: 'bg-band-drivable/12 text-band-drivable',
  apart: 'bg-band-apart/12 text-band-apart',
  no_match: 'text-warn ring-[1.5px] ring-inset ring-warn',
};

export const BAND_NAME: Record<Band, string> = {
  together: 'font-semibold',
  commutable: 'font-medium',
  drivable: 'font-medium',
  apart: 'font-normal',
  no_match: 'font-normal',
};

export function BandBadge({ band, bandLabel, distanceMi, className }: { band: Band; bandLabel: string; distanceMi: number | null; className?: string }) {
  const Icon = BAND_ICON[band];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs leading-none font-semibold whitespace-nowrap', BAND_CHIP[band], className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {bandLabel}
      {distanceMi != null ? <span className="font-mono font-medium tabular-nums">{` · ${Math.round(distanceMi)} mi`}</span> : null}
    </span>
  );
}
