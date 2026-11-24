'use client';
import { Check, MapPin, Plus, Search, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { addProgram, removeProgram, searchPrograms } from './actions';
import { AddProgramForm } from './add-program-form';
import { US_STATES } from '@pairwise/data';
import type { MapPoint, ProgramLite } from './types';

const STATE_OPTIONS = Object.entries(US_STATES)
  .map(([name, code]) => ({ code, name: name.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(' Of ', ' of ') }))
  .sort((a, b) => a.name.localeCompare(b.name));

const ProgramMap = dynamic(() => import('./program-map').then((m) => m.ProgramMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-surface-2" />,
});

export function ProgramsView({
  mySpecialty,
  specialties,
  initialResults,
  initialTotal,
  mine,
  partners,
  partnerName,
}: {
  mySpecialty: string;
  specialties: Array<{ code: string; name: string }>;
  initialResults: ProgramLite[];
  initialTotal: number;
  mine: ProgramLite[];
  partners: ProgramLite[];
  partnerName: string | null;
  privateTiers: boolean;
}) {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState(mySpecialty);
  const [results, setResults] = useState(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [state, setState] = useState('');
  const [searching, startSearch] = useTransition();
  const [showPartner, setShowPartner] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const toast = useToast();
  const mineIds = useMemo(() => new Set(mine.map((p) => p.id)), [mine]);

  useEffect(() => {
    const t = setTimeout(
      () =>
        startSearch(async () => {
          const res = await searchPrograms(query, specialty, state);
          setResults(res.results);
          setTotal(res.total);
        }),
      250,
    );
    return () => clearTimeout(t);
  }, [query, specialty, state]);

  const points: MapPoint[] = useMemo(() => {
    const pt = (p: ProgramLite, owner: MapPoint['owner']) =>
      p.lat != null && p.lon != null ? [{ id: `${owner}:${p.id}`, name: p.name, city: p.city, lat: p.lat, lon: p.lon, owner }] : [];
    return [...mine.flatMap((p) => pt(p, 'me')), ...(showPartner ? partners.flatMap((p) => pt(p, 'partner')) : [])];
  }, [mine, partners, showPartner]);

  async function toggle(p: ProgramLite) {
    setPending(p.id);
    const added = mineIds.has(p.id);
    const res = added ? await removeProgram(p.id) : await addProgram(p.id);
    setPending(null);
    if (res.error) toast({ message: res.error });
    else toast({ message: added ? `Removed ${p.name}` : `Added ${p.name}` });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My programs</h1>
          <p className="mt-1 text-sm text-muted">Add every program you’d be willing to go to. You’ll order and tier them next.</p>
        </div>
        <Link href="/app/rank" className={buttonVariants({ variant: mine.length ? 'primary' : 'secondary' })}>
          Next: rank {mine.length ? `(${mine.length})` : ''}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                className="pl-9"
                placeholder="Name, city or NRMP code"
                aria-label="Search programs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select aria-label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="sm:max-w-56">
              <option value="">All specialties</option>
              {specialties.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Select>
            <Select aria-label="State" value={state} onChange={(e) => setState(e.target.value)} className="sm:max-w-36">
              <option value="">All states</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            {searching
              ? 'Searching…'
              : total > results.length
                ? `Showing ${results.length} of ${total} programs. Type a name or city, or pick a state, to narrow it down.`
                : `${total} program${total === 1 ? '' : 's'}`}
          </p>
          <ul className="flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto" data-testid="search-results">
            {results.map((p) => {
              const added = mineIds.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.created_by_couple ? <p className="text-xs text-warn">Added by you · not checked yet</p> : null}
                    <p className="flex items-center gap-1 truncate text-xs text-muted">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {p.city}, {p.state}
                      {specialty === '' ? <> · {p.specialty_name}</> : null}
                      {p.nrmp_code ? <span className="font-mono"> · {p.nrmp_code}</span> : null}
                    </p>
                  </div>
                  <Button
                    variant={added ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={pending === p.id}
                    onClick={() => toggle(p)}
                    aria-label={added ? `Added: remove ${p.name}` : `Add ${p.name}`}
                  >
                    {added ? <><Check className="h-4 w-4" aria-hidden /> Added</> : <><Plus className="h-4 w-4" aria-hidden /> Add</>}
                  </Button>
                </li>
              );
            })}
            {!results.length && !searching ? <li className="py-8 text-center text-sm text-muted">No programs match.</li> : null}
          </ul>
          <AddProgramForm
            specialties={specialties}
            defaultSpecialty={specialty || mySpecialty}
            initialName={query}
            onAddExisting={async (p) => {
              if (!mineIds.has(p.id)) await toggle(p);
            }}
          />
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          <Card className="overflow-hidden p-0 sm:p-0">
            <ProgramMap points={points} className="h-[320px] w-full lg:h-[420px]" />
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> Mine ({mine.length})</span>
                {partnerName ? (
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-tier-b" aria-hidden /> {partnerName} ({partners.length})</span>
                ) : null}
              </span>
              {partnerName ? (
                <label className="flex items-center gap-1">
                  Show {partnerName}’s
                  <Switch checked={showPartner} onChange={setShowPartner} label={`Show ${partnerName}’s programs on the map`} />
                </label>
              ) : null}
            </div>
          </Card>
          <Card className="p-4 sm:p-4">
            <h2 className="mb-2 text-sm font-semibold">My list ({mine.length})</h2>
            {mine.length ? (
              <ul className="flex flex-wrap gap-2">
                {mine.map((p) => (
                  <li key={p.id} className="max-w-full">
                    <Badge tone="accent" className="max-w-full py-1 pr-1">
                      <span className="truncate">{p.name}</span>
                      <button className="rounded-full p-0.5 hover:bg-accent/10" aria-label={`Remove ${p.name}`} onClick={() => toggle(p)}>
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing yet — add programs from the search.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
