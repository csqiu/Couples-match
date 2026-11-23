import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { requireCouple } from '@/lib/context';
import { checklistFor, feesFor } from '@/lib/final-list';
import { serverFinalList } from '@/lib/server-list';
import { createClient } from '@/lib/supabase/server';
import type { VersionRow } from '@/lib/versions';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Printable list' };

/**
 * The list laid out for typing into R3: one column view per partner (each
 * partner enters their own list), then both side by side, plus the checklist.
 */
export default async function PrintList({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams;
  const ctx = await requireCouple();
  const current = await serverFinalList(ctx);
  const names = current.bundle.names;

  let rows: VersionRow[];
  let title = 'Current list';
  if (version) {
    const supabase = await createClient();
    const { data } = await supabase.from('list_versions').select('name, pairs, created_at').eq('id', version).eq('couple_id', ctx.couple.id).single();
    rows = (data?.pairs ?? []) as unknown as VersionRow[];
    title = data ? `${data.name} (saved ${new Date(data.created_at).toLocaleDateString()})` : 'Version not found';
  } else {
    rows = current.snapshot.pairs;
  }
  const live = version ? null : current.list;
  const checklist = live ? checklistFor(live.rows, live.length, names, live.hasCycles) : null;
  const fees = live ? feesFor(live.rows, live.length) : null;

  const th = 'border-b border-border py-1.5 pr-3 text-left text-xs font-semibold';
  const td = 'border-b border-border py-1 pr-3 align-top text-sm';
  return (
    <main className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href="/app/list" className={buttonVariants({ variant: 'secondary' })}>Back</Link>
        <PrintButton />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Couples rank list — {names[0]} &amp; {names[1]}</h1>
        <p className="text-sm text-muted">
          {title} · {rows.length} ranks · {ctx.couple.match_type === 'main' ? 'Main Residency Match' : ctx.couple.match_name}{' '}
          {ctx.couple.match_year} · printed {new Date().toLocaleDateString()}
        </p>
        <p className="mt-2 text-xs text-muted">
          A planning tool, not affiliated with the NRMP. Enter each row into R3 in this order and certify it yourselves.
        </p>
      </header>

      {checklist ? (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-2 font-semibold">Before you certify</h2>
          <ul className="text-sm">
            {checklist.map((c) => (
              <li key={c.label}>
                {c.ok ? '☑' : '☐'} {c.label}
                {c.detail ? <span className="text-muted"> — {c.detail}</span> : null}
              </li>
            ))}
          </ul>
          {fees ? (
            <p className="mt-2 text-sm">
              Estimated fees: {names[0]} ${fees.partners[0].totalUsd}, {names[1]} ${fees.partners[1].totalUsd} (estimate; base fees not included).
            </p>
          ) : null}
        </section>
      ) : null}

      {([0, 1] as const).map((k) => (
        <section key={k} className="mb-8 break-before-page first-of-type:break-before-auto" data-testid={`print-partner-${k}`}>
          <h2 className="mb-2 font-semibold">{names[k]}’s R3 entries</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Rank</th>
                <th className={th}>Program</th>
                <th className={th}>NRMP code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = k === 0 ? r.a : r.b;
                return (
                  <tr key={r.pairId} className="break-inside-avoid">
                    <td className={td}>{r.rank}</td>
                    <td className={td}>{s.name}</td>
                    <td className={`${td} font-mono`}>{s.code || '________'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <section className="break-before-page">
        <h2 className="mb-2 font-semibold">Both partners, side by side</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Rank</th>
              <th className={th}>{names[0]}</th>
              <th className={th}>Code</th>
              <th className={th}>{names[1]}</th>
              <th className={th}>Code</th>
              <th className={th}>Distance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pairId} className="break-inside-avoid">
                <td className={td}>{r.rank}</td>
                <td className={td}>{r.a.name}</td>
                <td className={`${td} font-mono`}>{r.a.code || '—'}</td>
                <td className={td}>{r.b.name}</td>
                <td className={`${td} font-mono`}>{r.b.code || '—'}</td>
                <td className={td}>
                  {r.bandLabel}
                  {r.distanceMi != null ? ` · ${Math.round(r.distanceMi)} mi` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
