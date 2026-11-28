'use client';
import { shortProgramName } from '@pairwise/data';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProgramLite } from './types';

/** Everything we know about a program, as a definition list. */
export function ProgramDetails({ program: p, children, hideShortName }: { program: ProgramLite; children?: ReactNode; hideShortName?: boolean }) {
  const place = `${p.city}, ${p.state}`;
  const address = !p.address ? place : p.address.includes(p.city) ? p.address : `${p.address}, ${place}`;
  const rows: Array<[string, ReactNode]> = [
    ['Program', p.name],
    ['Institution', p.institution],
    ['Specialty', p.specialty_name],
    ['Address', address],
    ...(p.cbsa_name ? [['Metro area', p.cbsa_name] as [string, ReactNode]] : []),
    ['NRMP code', p.nrmp_code ? <span className="font-mono">{p.nrmp_code}</span> : <span className="text-muted">Not in the directory yet</span>],
    ...(p.acgme_id ? [['ACGME ID', <span key="acgme" className="font-mono">{p.acgme_id}</span>] as [string, ReactNode]] : []),
    ['Track', p.is_advanced ? 'Advanced (starts in PGY-2)' : 'Categorical or preliminary (starts in PGY-1)'],
    ...(hideShortName ? [] : [['Short name', shortProgramName(p.name, p.short_name)] as [string, ReactNode]]),
    ['Source', p.created_by_couple ? 'Added by you · not checked yet' : p.verified ? 'Program directory · checked' : 'Program directory'],
  ];
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.institution, p.address, p.city, p.state].filter(Boolean).join(', '))}`;
  return (
    <div className="flex flex-col gap-3" data-testid="program-details">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7.5rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="mb-1 min-w-0 font-medium break-words sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-accent hover:bg-glass">
          <ExternalLink className="h-4 w-4" aria-hidden /> Open in Google Maps
        </a>
      </div>
    </div>
  );
}
