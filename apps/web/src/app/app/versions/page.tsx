import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react';
import { BandBadge } from '@/components/proximity';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { displayName, requireCouple } from '@/lib/context';
import { serverFinalList } from '@/lib/server-list';
import { createClient } from '@/lib/supabase/server';
import { versionLabel } from '@/lib/lists';
import { diffSummary, diffVersions, type VersionRow } from '@/lib/versions';
import { StarButton } from '../dashboard-controls';
import { VersionControls } from './version-controls';

export const metadata: Metadata = { title: 'Versions' };

export default async function VersionsPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const ctx = await requireCouple();
  const supabase = await createClient();
  const [{ data: versions }, { data: lists }] = await Promise.all([
    supabase
      .from('list_versions')
      .select('id, list_id, minor, starred, name, note, created_at, created_by, engine_version, pairs')
      .eq('couple_id', ctx.couple.id)
      .order('created_at', { ascending: false }),
    supabase.from('rank_lists').select('id, number').eq('couple_id', ctx.couple.id),
  ]);
  const numberOf = new Map((lists ?? []).map((l) => [l.id, l.number]));
  const labelOf = (v: { list_id: string; minor: number }) => versionLabel(numberOf.get(v.list_id) ?? 0, v.minor);
  const all = (versions ?? []).map((v) => ({ ...v, label: labelOf(v) }));
  // This page is about the open list; Compare can reach any list's versions.
  const list = all.filter((v) => v.list_id === ctx.list?.id);
  const who = (id: string | null) => (id === ctx.user.id ? 'you' : id && id === ctx.partner?.user_id ? displayName(ctx.partner) : 'someone');

  // Compare two versions (or a version against the current list).
  let diff: ReturnType<typeof diffVersions> | null = null;
  let labels: [string, string] = ['', ''];
  if (a && b && a !== b) {
    const current = a === 'current' || b === 'current' ? (await serverFinalList(ctx)).snapshot.pairs : null;
    const found = (id: string) => all.find((v) => v.id === id);
    const rowsOf = (id: string) => (id === 'current' ? current! : ((found(id)?.pairs ?? []) as unknown as VersionRow[]));
    const nameOf = (id: string) => (id === 'current' ? 'Current list' : found(id) ? `${found(id)!.label} · ${found(id)!.name}` : '?');
    diff = diffVersions(rowsOf(a), rowsOf(b));
    labels = [nameOf(a), nameOf(b)];
  }

  const options = [{ id: 'current', name: 'Current list' }, ...all.map((v) => ({ id: v.id, name: `${v.label} · ${v.name}` }))];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Versions of List {ctx.list?.number ?? ''}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Frozen snapshots of your list. Rename them, compare any two, print one, or restore one as your working list.
          </p>
        </div>
        <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Back to the list</Link>
      </div>

      {list.length === 0 ? (
        <p className="glass border-dashed p-8 text-center text-sm text-muted">
          No versions of this list yet. Save one from the final list.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="versions">
          {list.map((v) => (
            <li key={v.id}>
              <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <StarButton id={v.id} label={v.label} starred={v.starred} />
                  <span className="font-mono font-semibold text-plum-deep">{v.label}</span>
                  <div className="min-w-0">
                  <p className="small-title">{v.name}</p>
                  <p className="text-xs text-muted">
                    {(v.pairs as unknown as VersionRow[]).length} ranks · saved by {who(v.created_by)} ·{' '}
                    <span className="font-mono">{new Date(v.created_at).toLocaleString()}</span>
                    {v.note ? ` · ${v.note}` : ''}
                  </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Link href={`/print/list?version=${v.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Print</Link>
                  <VersionControls id={v.id} name={v.name} note={v.note} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {list.length ? (
        <Card>
          <h2 className="card-title mb-3">Compare</h2>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" action="/app/versions">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Older
              <Select name="a" defaultValue={a ?? list[0]?.id}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Newer
              <Select name="b" defaultValue={b ?? 'current'}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </label>
            <button className={buttonVariants()}>Compare</button>
          </form>

          {diff ? (
            <div className="mt-4" data-testid="diff">
              {(() => {
                const s = diffSummary(diff);
                return (
                  <p className="mb-3 text-sm text-muted">
                    <strong className="text-text">{labels[0]}</strong> → <strong className="text-text">{labels[1]}</strong>: {s.moved} moved,{' '}
                    {s.added} added, {s.removed} removed, {s.same} unchanged.
                  </p>
                );
              })()}
              <ol className="flex flex-col gap-1">
                {diff.map((d) => (
                  <li
                    key={d.pairId + d.kind}
                    className={cn(
                      'glass-row grid grid-cols-[4.5rem_1fr] items-center gap-3 px-3.5 py-2.5 text-sm sm:grid-cols-[4.5rem_1fr_1fr_auto]',
                      d.kind === 'same' && 'border-transparent bg-transparent',
                      d.kind === 'removed' && 'bg-warn-soft/70 text-muted line-through',
                      d.kind === 'up' && 'bg-accent-soft/70',
                      d.kind === 'down' && 'bg-danger-soft/80',
                      d.kind === 'added' && 'bg-partner-2-soft/70',
                    )}
                    data-change={d.kind}
                  >
                    <span className="flex items-center gap-1 font-mono text-[13px] tabular-nums">
                      {d.kind === 'up' ? <ArrowUp className="h-3.5 w-3.5 text-accent" aria-label="moved up" /> : null}
                      {d.kind === 'down' ? <ArrowDown className="h-3.5 w-3.5 text-danger" aria-label="moved down" /> : null}
                      {d.kind === 'added' ? <Plus className="h-3.5 w-3.5 text-plum-deep" aria-label="added" /> : null}
                      {d.kind === 'removed' ? <Minus className="h-3.5 w-3.5" aria-label="removed" /> : null}
                      {d.before ?? '–'}→{d.after ?? '–'}
                    </span>
                    <span className="truncate">{d.row.a.name}</span>
                    <span className="col-start-2 truncate sm:col-start-auto">{d.row.b.name}</span>
                    <BandBadge band={d.row.band} bandLabel={d.row.bandLabel} distanceMi={d.row.distanceMi} className="col-start-2 justify-self-start sm:col-start-auto" />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
