'use client';
import { Check, Crosshair, GitMerge, MapPin, Pencil, RefreshCw, Search } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';
import { MiniMap } from '@/components/mini-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { REASON_LABEL, type DuplicatePair, type ReviewProgram, type ReviewQueue, type ReviewReason } from '@/lib/admin-review';
import { approvePrograms, editProgram, findMergeTargets, mergePrograms, relocateProgram, setLocation } from './actions';

/** Runs a server action, shows its error (or a success message) as a toast. */
function useRun() {
  const [busy, start] = useTransition();
  const toast = useToast();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      toast({ message: res.error ?? ok });
    });
  return { busy, run };
}

const point = (p: ReviewProgram) => (p.lat != null && p.lon != null ? [{ lat: p.lat, lon: p.lon }] : []);

function locationText(p: ReviewProgram) {
  if (p.lat == null) return 'No location';
  const how = p.geocode_source === 'manual' ? 'set by hand' : p.geocode_source === 'nominatim' ? 'OpenStreetMap' : 'US Census';
  return `${how}${p.geocode_confidence != null ? `, ${Math.round(p.geocode_confidence * 100)}% sure` : ''}`;
}

function ProgramSummary({ p }: { p: ReviewProgram }) {
  return (
    <div className="min-w-0">
      <p className="font-medium leading-snug">{p.name}</p>
      <p className="text-sm text-muted">{p.specialty_name}{p.institution && p.institution !== p.name ? ` · ${p.institution}` : ''}</p>
      <p className="mt-1 flex items-start gap-1 text-sm text-muted">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{p.address || `${p.city}, ${p.state}`}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted">
        Location: {locationText(p)} · From: {p.created_by_couple ? 'a couple' : p.source}
      </p>
    </div>
  );
}

export function ReviewQueueView({ queue }: { queue: ReviewQueue }) {
  const { busy, run } = useRun();
  const total = queue.duplicates.length + queue.attention.length + queue.routine.length;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Review programs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Programs couples added, imported programs whose location looks doubtful, and possible duplicates. Approving a couple’s
          program makes it available to everyone in its match.
        </p>
      </div>

      {total === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Nothing to review. 🎉</Card>
      ) : null}

      {queue.duplicates.length ? (
        <section aria-labelledby="dups" className="flex flex-col gap-3">
          <h2 id="dups" className="text-lg font-semibold">Possible duplicates ({queue.duplicates.length})</h2>
          <p className="-mt-2 text-sm text-muted">Same specialty, less than a mile apart. Keep one and the other is merged into it: every couple who listed it keeps their place, answers and codes.</p>
          {queue.duplicates.map((d) => (
            <DuplicateCard key={`${d.a.id}|${d.b.id}`} pair={d} />
          ))}
        </section>
      ) : null}

      {queue.attention.length ? (
        <section aria-labelledby="attention" className="flex flex-col gap-3">
          <h2 id="attention" className="text-lg font-semibold">Needs a look ({queue.attention.length})</h2>
          {queue.attention.map(({ program, reasons }) => (
            <ProgramCard key={program.id} program={program} reasons={reasons} />
          ))}
        </section>
      ) : null}

      {queue.routine.length ? (
        <section aria-labelledby="routine" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="routine" className="text-lg font-semibold">Imported, nothing flagged ({queue.routine.length})</h2>
              <p className="text-sm text-muted">Found on the map with confidence and not near another listing. Spot-check a few, then approve.</p>
            </div>
            <Button disabled={busy} onClick={() => run(() => approvePrograms(queue.routine.map((p) => p.id)), `Approved ${queue.routine.length} programs`)}>
              <Check className="h-4 w-4" aria-hidden /> Approve all {queue.routine.length}
            </Button>
          </div>
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-border">
              {queue.routine.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.address} · {locationText(p)}</span>
                  </span>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => approvePrograms([p.id]), `Approved ${p.name}`)} aria-label={`Approve ${p.name}`}>
                    Approve
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function DuplicateCard({ pair }: { pair: DuplicatePair }) {
  const { busy, run } = useRun();
  const keep = (kept: ReviewProgram, gone: ReviewProgram) => {
    if (!window.confirm(`Merge “${gone.name}” into “${kept.name}”? “${gone.name}” will be removed.`)) return;
    run(() => mergePrograms(gone.id, kept.id), `Merged into ${kept.name}`);
  };
  const unverified = [pair.a, pair.b].filter((p) => !p.verified).map((p) => p.id);
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-4" data-testid="duplicate-pair">
      <MiniMap points={[...point(pair.a), ...point(pair.b)]} className="h-32 w-full rounded-lg bg-surface-2" label={`Map of ${pair.a.name} and ${pair.b.name}`} />
      <p className="text-xs text-muted">{pair.distanceMi < 0.05 ? 'Same spot' : `${pair.distanceMi.toFixed(2)} miles apart`}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[pair.a, pair.b].map((p, i) => {
          const other = i === 0 ? pair.b : pair.a;
          return (
            <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap gap-1">
                {p.verified ? <Badge tone="accent">Approved</Badge> : <Badge tone="warn">Not checked</Badge>}
                {p.created_by_couple ? <Badge>Added by a couple</Badge> : null}
              </div>
              <ProgramSummary p={p} />
              <Button size="sm" className="mt-auto self-start" disabled={busy} onClick={() => keep(p, other)}>
                <GitMerge className="h-4 w-4" aria-hidden /> Keep this one
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={busy}
        onClick={() => run(() => approvePrograms(unverified), 'Kept both')}
      >
        They’re different programs: keep both
      </Button>
    </Card>
  );
}

type Panel = null | 'edit' | 'location' | 'merge';

function ProgramCard({ program: p, reasons }: { program: ReviewProgram; reasons: ReviewReason[] }) {
  const { busy, run } = useRun();
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (x: Panel) => setPanel((cur) => (cur === x ? null : x));
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-4" data-testid="review-program">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {reasons.map((r) => (
              <Badge key={r} tone={r === 'added_by_couple' ? 'accent' : 'warn'}>{REASON_LABEL[r]}</Badge>
            ))}
          </div>
          <ProgramSummary p={p} />
        </div>
        {p.lat != null ? (
          <MiniMap points={point(p)} className="h-32 w-full shrink-0 rounded-lg bg-surface-2 sm:w-56" label={`Map of ${p.name}`} />
        ) : (
          <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm text-muted sm:w-56">No location</div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || p.lat == null} onClick={() => run(() => approvePrograms([p.id]), `Approved ${p.name}`)} title={p.lat == null ? 'Set a location first' : undefined}>
          <Check className="h-4 w-4" aria-hidden /> Approve
        </Button>
        <Button size="sm" variant="secondary" aria-expanded={panel === 'edit'} onClick={() => toggle('edit')}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => relocateProgram(p.id), 'Found it on the map again')}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Find on map again
        </Button>
        <Button size="sm" variant="secondary" aria-expanded={panel === 'location'} onClick={() => toggle('location')}>
          <Crosshair className="h-4 w-4" aria-hidden /> Set location by hand
        </Button>
        <Button size="sm" variant="secondary" aria-expanded={panel === 'merge'} onClick={() => toggle('merge')}>
          <GitMerge className="h-4 w-4" aria-hidden /> Merge into…
        </Button>
      </div>
      {panel === 'edit' ? <EditPanel p={p} onDone={() => setPanel(null)} /> : null}
      {panel === 'location' ? <LocationPanel p={p} onDone={() => setPanel(null)} /> : null}
      {panel === 'merge' ? <MergePanel p={p} /> : null}
    </Card>
  );
}

function EditPanel({ p, onDone }: { p: ReviewProgram; onDone: () => void }) {
  const id = useId();
  const { busy, run } = useRun();
  const [f, setF] = useState({ name: p.name, institution: p.institution, address: p.address, city: p.city, state: p.state });
  const field = (k: keyof typeof f) => ({ id: `${id}-${k}`, value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const res = await editProgram(p.id, f);
          if (!res.error) onDone();
          return res;
        }, 'Saved. Use “Find on map again” if you changed the address.');
      }}
    >
      <Field label="Name" htmlFor={`${id}-name`}><Input {...field('name')} /></Field>
      <Field label="Institution" htmlFor={`${id}-institution`}><Input {...field('institution')} /></Field>
      <Field label="Full address" htmlFor={`${id}-address`} hint="Street, city, state and ZIP, separated by commas"><Input {...field('address')} /></Field>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
        <Field label="City" htmlFor={`${id}-city`}><Input {...field('city')} /></Field>
        <Field label="State" htmlFor={`${id}-state`}><Input {...field('state')} maxLength={2} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy}>Save</Button>
      </div>
    </form>
  );
}

function LocationPanel({ p, onDone }: { p: ReviewProgram; onDone: () => void }) {
  const id = useId();
  const { busy, run } = useRun();
  const [text, setText] = useState(p.lat != null ? `${p.lat.toFixed(5)}, ${p.lon!.toFixed(5)}` : '');
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const [lat, lon] = text.split(/[,\s]+/).filter(Boolean).map(Number);
        run(async () => {
          const res = await setLocation(p.id, lat, lon);
          if (!res.error) onDone();
          return res;
        }, 'Location saved');
      }}
    >
      <Field label="Latitude, longitude" htmlFor={`${id}-ll`} hint="In Google or Apple Maps, right-click (or long-press) the hospital and copy its coordinates.">
        <Input id={`${id}-ll`} value={text} onChange={(e) => setText(e.target.value)} placeholder="42.36249, -71.06983" inputMode="decimal" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy}>Save location</Button>
      </div>
    </form>
  );
}

function MergePanel({ p }: { p: ReviewProgram }) {
  const id = useId();
  const { busy, run } = useRun();
  const [query, setQuery] = useState(p.institution.split(/[,(]/)[0]);
  const [targets, setTargets] = useState<ReviewProgram[]>([]);
  const [searching, startSearch] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => startSearch(async () => setTargets(await findMergeTargets(query, p.specialty_code, p.id))), 250);
    return () => clearTimeout(t);
  }, [query, p.specialty_code, p.id]);
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
      <Field label={`Merge “${p.name}” into another ${p.specialty_name} program`} htmlFor={`${id}-q`}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id={`${id}-q`} className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </Field>
      <ul className="flex flex-col divide-y divide-border" aria-busy={searching}>
        {targets.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{t.name}</span>
              <span className="block truncate text-xs text-muted">{t.address || `${t.city}, ${t.state}`}{t.verified ? '' : ' · not checked'}</span>
            </span>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Merge “${p.name}” into “${t.name}”? “${p.name}” will be removed.`)) run(() => mergePrograms(p.id, t.id), `Merged into ${t.name}`);
              }}
            >
              Merge into this
            </Button>
          </li>
        ))}
        {!targets.length && !searching ? <li className="py-3 text-sm text-muted">No matching programs.</li> : null}
      </ul>
    </div>
  );
}
