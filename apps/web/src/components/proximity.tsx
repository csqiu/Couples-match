import type { Band } from '@pairwise/engine';
import { Car, CarFront, Heart, Plane, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

/**
 * Proximity styling (spec Section 7), used everywhere a pair appears. Color is
 * never the only signal: every band also has a text badge and an icon.
 */
export const BAND_ICON = { together: Heart, commutable: CarFront, drivable: Car, apart: Plane, no_match: TriangleAlert } as const;

export const BAND_ROW: Record<Band, string> = {
  together: 'bg-accent-soft border-transparent',
  commutable: 'bg-accent-soft/50 border-transparent',
  drivable: 'bg-surface border-border',
  apart: 'bg-surface border-border text-muted',
  no_match: 'bg-surface border-dashed border-warn',
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
  const tone = band === 'together' || band === 'commutable' ? 'accent' : band === 'no_match' ? 'warn' : 'neutral';
  return (
    <Badge tone={tone} className={cn('shrink-0', className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {bandLabel}
      {distanceMi != null ? ` · ${Math.round(distanceMi)} mi` : ''}
    </Badge>
  );
}
