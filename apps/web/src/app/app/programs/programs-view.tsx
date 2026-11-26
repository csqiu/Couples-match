'use client';
import { shortProgramName } from '@pairwise/data';
import { Check, ChevronDown, MapPin, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/toast';
import { addProgram, removeProgram, restoreRemoved, restoreSavedList, saveShortName, searchPrograms, type RemovedRank } from './actions';
import { AddProgramForm } from './add-program-form';
import { US_STATES } from '@pairwise/data';
import { ProgramDetails } from './program-details';
import type { MapPoint, MyProgram, ProgramLite } from './types';

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
  savedCount = 0,
  mySlot = 1,
}: {
  savedCount?: number;
  mySlot?: 1 | 2;
  mySpecialty: string;
  specialties: Array<{ code: string; name: string }>;
  initialResults: ProgramLite[];
  initialTotal: number;
  mine: MyProgram[];
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
  const [restoring, setRestoring] = useState(false);
  // One program open at a time, in either list: 'r:<id>' (search results) or 'm:<id>' (my list).
  const [open, setOpen] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchKey = useRef('');
  const sentinelRef = useRef<HTMLLIElement>(null);
  const toast = useToast();
  const mineIds = useMemo(() => new Set(mine.map((p) => p.id)), [mine]);
  // Adding or removing refreshes the page's data; put both scroll positions back
  // afterwards so the list doesn't jump (bug log #3).
  const listRef = useRef<HTMLUListElement>(null);
  const keep = useRef<{ page: number; list: number } | null>(null);
  useLayoutEffect(() => {
    const k = keep.current;
    if (!k) return;
    const restore = () => {
      window.scrollTo({ top: k.page, behavior: 'instant' });
      if (listRef.current) listRef.current.scrollTop = k.list;
    };
    restore();
    const raf = requestAnimationFrame(restore); // once more, after the map and fonts settle
    keep.current = null;
    return () => cancelAnimationFrame(raf);
  }, [mine]);

  useEffect(() => {
    const key = `${query}\u0000${specialty}\u0000${state}`;
    const t = setTimeout(
      () =>
        startSearch(async () => {
          searchKey.current = key;
          const res = await searchPrograms(query, specialty, state).catch(() => null);
          if (searchKey.current !== key || !res) return;
          setResults(res.results);
          setTotal(res.total);
          if (listRef.current) listRef.current.scrollTop = 0;
        }),
      250,
    );
    return () => clearTimeout(t);
  }, [query, specialty, state]);

  // Infinite scroll: when the end of the list comes into view, load the next page.
  const hasMore = results.length < total;
  useEffect(() => {
    const el = sentinelRef.current;
    const root = listRef.current;
    if (!el || !root || !hasMore || searching) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || loadingMore) return;
        const key = searchKey.current;
        setLoadingMore(true);
        searchPrograms(query, specialty, state, results.length)
          .then((res) => {
            if (searchKey.current !== key) return;
            if (!res.results.length) return setTotal(results.length);
            setResults((rs) => {
              const seen = new Set(rs.map((r) => r.id));
              return [...rs, ...res.results.filter((r) => !seen.has(r.id))];
            });
            setTotal(res.total);
          })
          .catch(() => toast({ message: 'Couldn’t load more programs. Scroll again to retry.' }))
          .finally(() => setLoadingMore(false));
      },
      { root, rootMargin: '0px 0px 240px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, searching, loadingMore, results.length, query, specialty, state]);

  const points: MapPoint[] = useMemo(() => {
    const pt = (p: ProgramLite, owner: MapPoint['owner']) =>
      p.lat != null && p.lon != null ? [{ id: `${owner}:${p.id}`, name: p.name, city: p.city, lat: p.lat, lon: p.lon, owner }] : [];
    return [...mine.flatMap((p) => pt(p, 'me')), ...(showPartner ? partners.flatMap((p) => pt(p, 'partner')) : [])];
  }, [mine, partners, showPartner]);

  async function toggle(p: ProgramLite) {
    if (pending === p.id) return;
    keep.current = { page: window.scrollY, list: listRef.current?.scrollTop ?? 0 };
    setPending(p.id);
    const added = mineIds.has(p.id);
    const res: { error?: string; removed?: RemovedRank } = added ? await removeProgram(p.id) : await addProgram(p.id);
    setPending(null);
    if (res.error) keep.current = null;
    if (res.error) return toast({ message: res.error });
    const removed = res.removed;
    toast({
      message: added ? `Removed ${p.name}` : `Added ${p.name}`,
      // Same Undo as on Rank: back with its tier, note, code and short name, in its old place (bug log #40).
      action: removed
        ? {
            label: 'Undo',
            onClick: async () => {
              keep.current = { page: window.scrollY, list: listRef.current?.scrollTop ?? 0 };
              const back = await restoreRemoved(removed);
              if (back.error) {
                keep.current = null;
                toast({ message: `Couldn’t put it back: ${back.error}` });
              }
            },
          }
        : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">My programs</h1>
          <p className="mt-1 text-sm text-muted">Add every program you’d be willing to go to. You’ll order and tier them next.</p>
        </div>
        <Link href="/app" className={buttonVariants({ variant: mine.length ? 'primary' : 'secondary' })}>
          Next: dashboard {mine.length ? `(${mine.length})` : ''}
        </Link>
      </div>

      {savedCount > 0 && mine.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-glass-border bg-accent-soft/80 px-4 py-3 text-sm" role="status">
          <span>
            You have a saved list of <strong>{savedCount} program{savedCount === 1 ? '' : 's'}</strong> from your last couple.
          </span>
          <Button
            size="sm"
            disabled={restoring}
            onClick={async () => {
              setRestoring(true);
              const res = await restoreSavedList();
              setRestoring(false);
              toast({ message: res.error ? `Couldn’t bring it back: ${res.error}` : `Brought back ${res.count} program${res.count === 1 ? '' : 's'}.` });
            }}
          >
            {restoring ? 'Bringing it back…' : 'Bring back my list'}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-4">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                className="pl-9"
                placeholder="Name, city or NRMP code"
                aria-label="Search programs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] gap-2">
            <Select aria-label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">All specialties</option>
              {specialties.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Select>
            <Select aria-label="State" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">All states</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Select>
            </div>
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            {searching
              ? 'Searching…'
              : `${total} program${total === 1 ? '' : 's'}${hasMore ? ` · showing ${results.length}, scroll for more` : ''}. Tap one for details.`}
          </p>
          <ul ref={listRef} className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto [overflow-anchor:none]" data-testid="search-results">
            {results.map((p) => {
              const added = mineIds.has(p.id);
              const isOpen = open === `r:${p.id}`;
              const addButton = (
                <Button
                  variant={added ? 'secondary' : 'primary'}
                  size="sm"
                  // aria-disabled, not disabled: disabling the focused button would drop focus.
                  aria-disabled={pending === p.id}
                  onClick={() => toggle(p)}
                  aria-label={added ? `Added: remove ${p.name}` : `Add ${p.name}`}
                >
                  {added ? <><Check className="h-4 w-4" aria-hidden /> Added</> : <><Plus className="h-4 w-4" aria-hidden /> Add</>}
                </Button>
              );
              return (
                <li
                  key={p.id}
                  className={cn(
                    'glass-row flex flex-col px-3.5 py-2.5 transition-colors duration-150',
                    p.created_by_couple && 'border-dashed border-border',
                    isOpen && 'bg-surface ring-2 ring-action/25',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="-my-1 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[12px] text-left"
                      aria-expanded={isOpen}
                      aria-controls={`details-r-${p.id}`}
                      onClick={() => setOpen(isOpen ? null : `r:${p.id}`)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm font-medium', isOpen ? 'font-display text-[15.5px] font-semibold' : 'line-clamp-2')} title={p.name}>{p.name}</span>
                        {p.created_by_couple ? <span className="block text-xs text-warn">Added by you · not checked yet</span> : null}
                        <span className="flex items-center gap-1 truncate text-xs text-muted">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {p.city}, {p.state}
                          {specialty === '' ? <> · {p.specialty_name}</> : null}
                          {p.nrmp_code ? <span className="font-mono"> · {p.nrmp_code}</span> : null}
                        </span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-150', isOpen && 'rotate-180')} aria-hidden />
                    </button>
                    {addButton}
                  </div>
                  {isOpen ? (
                    <div id={`details-r-${p.id}`} className="mt-3 border-t border-border pt-3">
                      <ProgramDetails program={p} />
                    </div>
                  ) : null}
                </li>
              );
            })}
            {hasMore ? (
              <li ref={sentinelRef} className="py-3 text-center text-xs text-muted" aria-hidden>
                {loadingMore ? 'Loading more…' : ' '}
              </li>
            ) : null}
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
            <ProgramMap points={points} mySlot={mySlot} className="h-[320px] w-full lg:h-[420px]" />
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', mySlot === 1 ? 'bg-partner-1' : 'bg-partner-2')} aria-hidden /> Mine ({mine.length})</span>
                {partnerName ? (
                  <span className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full border-2', mySlot === 1 ? 'border-partner-2' : 'border-partner-1')} aria-hidden /> {partnerName} ({partners.length})</span>
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
            <h2 className="small-title mb-1">My list <span className="font-mono text-sm font-normal text-muted">({mine.length})</span></h2>
            {mine.length ? (
              <>
                <p className="mb-2 text-xs text-muted">Tap a program for its details and to rename its short name.</p>
                <ul className="flex flex-wrap gap-1.5">
                  {mine.map((p) => {
                    const isOpen = open === `m:${p.id}`;
                    return (
                      <li key={p.id} className="max-w-full">
                        <span
                          className={cn(
                            'glass-row inline-flex max-w-full items-center rounded-full py-0.5 pr-1 pl-0.5 text-[13px] font-semibold transition-colors duration-150',
                            isOpen && 'border-action bg-action-soft',
                          )}
                        >
                          <button
                            type="button"
                            className="min-h-9 min-w-0 truncate rounded-full px-2.5 text-left"
                            aria-expanded={isOpen}
                            aria-controls="my-program-details"
                            title={p.name}
                            onClick={() => setOpen(isOpen ? null : `m:${p.id}`)}
                          >
                            {shortProgramName(p.name, p.my_short ?? p.short_name)}
                          </button>
                          <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-text/10 hover:text-text" aria-label={`Remove ${p.name}`} onClick={() => toggle(p)}>
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {(() => {
                  const p = mine.find((x) => open === `m:${x.id}`);
                  return p ? (
                    <div id="my-program-details" className="mt-3 rounded-[20px] border border-glass-border bg-surface p-4" data-testid="my-program-card">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h3 className="small-title">{p.name}</h3>
                        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong hover:text-text" aria-label="Close details" onClick={() => setOpen(null)}>
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <ShortNameEditor key={p.id} program={p} />
                      <div className="mt-4 border-t border-border pt-3">
                        <ProgramDetails program={p} hideShortName>
                          <Button variant="danger-soft" size="sm" onClick={() => { setOpen(null); void toggle(p); }}>
                            <Trash2 className="h-4 w-4" aria-hidden /> Remove from my list
                          </Button>
                        </ProgramDetails>
                      </div>
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <p className="text-sm text-muted">Nothing yet — add programs from the search.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** My own short name for a program: how it reads on our lists. Blank = automatic. */
function ShortNameEditor({ program: p }: { program: MyProgram }) {
  const auto = shortProgramName(p.name, p.short_name);
  const [value, setValue] = useState(p.my_short ?? '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const id = `short-${p.id}`;
  async function save(next: string) {
    setSaving(true);
    const res = await saveShortName(p.id, next);
    setSaving(false);
    if (res.error) toast({ message: `Couldn’t save: ${res.error}` });
    else toast({ message: next.trim() ? `Now shown as “${next.trim()}”.` : `Back to “${auto}”.` });
  }
  const changed = value.trim() !== (p.my_short ?? '');
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(value);
      }}
    >
      <label htmlFor={id} className="text-[13px] font-semibold">Short name</label>
      <div className="flex flex-wrap gap-2">
        <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder={auto} maxLength={40} className="min-w-0 flex-1 basis-48" />
        <Button type="submit" size="sm" className="min-h-[46px]" disabled={saving || !changed}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {p.my_short ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[46px]"
            disabled={saving}
            onClick={() => {
              setValue('');
              void save('');
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Use “{auto}”
          </Button>
        ) : null}
      </div>
      <p className="text-[12.5px] text-muted">How this program reads on your lists, for both of you. Leave blank for “{auto}”.</p>
    </form>
  );
}
