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
import { diffSummary, diffVersions, type VersionRow } from '@/lib/versions';
import { VersionControls } from './version-controls';

export const metadata: Metadata = { title: 'Versions' };

export default async function VersionsPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: versions } = await supabase
    .from('list_versions')
    .select('id, name, note, created_at, created_by, engine_version, pairs')
    .eq('couple_id', ctx.couple.id)
    .order('created_at', { ascending: false });
  const list = versions ?? [];
  const who = (id: string | null) => (id === ctx.user.id ? 'you' : id && id === ctx.partner?.user_id ? displayName(ctx.partner) : 'someone');

  // Compare two versions (or a version against the current list).
  let diff: ReturnType<typeof diffVersions> | null = null;
  let labels: [string, string] = ['', ''];
  if (a && b && a !== b) {
    const current = a === 'current' || b === 'current' ? (await serverFinalList(ctx)).snapshot.pairs : null;
    const rowsOf = (id: string) => (id === 'current' ? current! : ((list.find((v) => v.id === id)?.pairs ?? []) as unknown as VersionRow[]));
    const nameOf = (id: string) => (id === 'current' ? 'Current list' : (list.find((v) => v.id === id)?.name ?? '?'));
    diff = diffVersions(rowsOf(a), rowsOf(b));
    labels = [nameOf(a), nameOf(b)];
  }

  const options = [{ id: 'current', name: 'Current list' }, ...list.map((v) => ({ id: v.id, name: v.name }))];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Versions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Frozen snapshots of your list. Rename them, compare any two, print one, or restore one as your working list.
          </p>
        </div>
        <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Back to the list</Link>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No versions yet. Save one from the final list.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="versions">
          {list.map((v) => (
            <li key={v.id}>
              <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="min-w-0">
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-muted">
                    {(v.pairs as unknown as VersionRow[]).length} ranks · saved by {who(v.created_by)} ·{' '}
                    {new Date(v.created_at).toLocaleString()}
                    {v.note ? ` · ${v.note}` : ''}
                  </p>
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
          <h2 className="mb-3 font-semibold">Compare</h2>
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
                      'grid grid-cols-[4.5rem_1fr] items-center gap-3 rounded-lg border px-3 py-2 text-sm sm:grid-cols-[4.5rem_1fr_1fr_auto]',
                      d.kind === 'same' ? 'border-transparent' : 'border-border',
                      d.kind === 'removed' && 'text-muted line-through',
                      (d.kind === 'up' || d.kind === 'down' || d.kind === 'added') && 'bg-accent-soft/60',
                    )}
                    data-change={d.kind}
                  >
                    <span className="flex items-center gap-1 tabular-nums">
                      {d.kind === 'up' ? <ArrowUp className="h-3.5 w-3.5 text-accent" aria-label="moved up" /> : null}
                      {d.kind === 'down' ? <ArrowDown className="h-3.5 w-3.5 text-warn" aria-label="moved down" /> : null}
                      {d.kind === 'added' ? <Plus className="h-3.5 w-3.5 text-accent" aria-label="added" /> : null}
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
